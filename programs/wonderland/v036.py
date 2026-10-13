def predict_next_state(state, action):
    if not isinstance(state, dict):
        raise ValueError('state must be a dict.')
    if not isinstance(action, str):
        raise ValueError('action must be a string.')
    next_state = _copy_value(state)
    if not isinstance(next_state, dict):
        return {}
    objects = next_state.get('objects')
    rules = _extract_rules(objects)
    transformed_objects = _transform_objects(objects, rules)
    before_move_objects = _copy_value(transformed_objects)
    grid_size = next_state.get('grid_size')
    moved_objects = _move_objects(transformed_objects, rules, action, grid_size)
    post_move_rules = _extract_rules(moved_objects)
    post_begin_words = post_move_rules.get('begin', []) if isinstance(post_move_rules, dict) else []
    post_wrong_words = post_move_rules.get('wrong', []) if isinstance(post_move_rules, dict) else []
    if isinstance(post_begin_words, list) and len(post_begin_words) > 0 and isinstance(post_wrong_words, list) and (len(post_wrong_words) == 0):
        moved_objects = _resolve_begin_overlaps(moved_objects, moved_objects, post_begin_words, post_wrong_words)
    final_objects = _transform_objects(moved_objects, _extract_rules(moved_objects))
    next_state['objects'] = final_objects
    step = next_state.get('step')
    if isinstance(step, dict):
        final_rules = _extract_rules(final_objects)
        step['terminated'] = _should_terminate_transition(before_move_objects, final_objects, final_rules)
    return next_state

def _copy_value(value):
    if isinstance(value, dict):
        result = {}
        for key in value:
            result[key] = _copy_value(value[key])
        return result
    if isinstance(value, list):
        result = []
        index = 0
        while index < len(value):
            result.append(_copy_value(value[index]))
            index += 1
        return result
    return value

def _extract_rules(objects):
    rules = {}
    transforms = {}
    if not isinstance(objects, list):
        return rules
    directions = [[1, 0], [0, 1]]
    index = 0
    while index < len(objects):
        first = objects[index]
        if isinstance(first, dict) and first.get('type') == 'rule_noun':
            first_pos = first.get('position')
            first_word = first.get('word')
            if _is_position(first_pos) and isinstance(first_word, str):
                direction_index = 0
                while direction_index < len(directions):
                    dx = directions[direction_index][0]
                    dy = directions[direction_index][1]
                    second = _object_at_position(objects, first_pos[0] + dx, first_pos[1] + dy, 'rule_operator')
                    if isinstance(second, dict) and second.get('word') == 'is':
                        third_property = _object_at_position(objects, first_pos[0] + 2 * dx, first_pos[1] + 2 * dy, 'rule_property')
                        if _is_rule_triplet(first, second, third_property, dx, dy):
                            prop = third_property.get('word')
                            if isinstance(prop, str) and first_word not in rules.get(prop, []):
                                rules[prop] = rules.get(prop, []) + [first_word]
                            step = 3
                            while True:
                                and_obj = _object_at_position(objects, first_pos[0] + step * dx, first_pos[1] + step * dy, 'rule_operator')
                                next_prop = _object_at_position(objects, first_pos[0] + (step + 1) * dx, first_pos[1] + (step + 1) * dy, 'rule_property')
                                and_pos = and_obj.get('position') if isinstance(and_obj, dict) else None
                                next_pos = next_prop.get('position') if isinstance(next_prop, dict) else None
                                if not isinstance(and_obj, dict) or and_obj.get('word') != 'and':
                                    break
                                if not _is_position(and_pos) or not _is_position(next_pos):
                                    break
                                if and_pos[0] != first_pos[0] + step * dx or and_pos[1] != first_pos[1] + step * dy:
                                    break
                                if next_pos[0] != first_pos[0] + (step + 1) * dx or next_pos[1] != first_pos[1] + (step + 1) * dy:
                                    break
                                prop = next_prop.get('word')
                                if isinstance(prop, str) and first_word not in rules.get(prop, []):
                                    rules[prop] = rules.get(prop, []) + [first_word]
                                step += 2
                        else:
                            third_noun = _object_at_position(objects, first_pos[0] + 2 * dx, first_pos[1] + 2 * dy, 'rule_noun')
                            if _is_noun_rule_triplet(first, second, third_noun, dx, dy):
                                target_word = third_noun.get('word')
                                if isinstance(target_word, str):
                                    transforms[first_word] = target_word
                    direction_index += 1
        index += 1
    if len(transforms) > 0:
        rules['_transform'] = transforms
    destructive_words = []
    eat_words = rules.get('eat', [])
    late_words = rules.get('late', [])
    if isinstance(eat_words, list) and isinstance(late_words, list):
        index = 0
        while index < len(eat_words):
            word = eat_words[index]
            if word in late_words and word not in destructive_words:
                destructive_words.append(word)
            index += 1
    if len(destructive_words) > 0:
        rules['_destructive'] = destructive_words
    return rules

def _is_rule_triplet(first, second, third, dx, dy):
    if not isinstance(first, dict) or not isinstance(second, dict) or (not isinstance(third, dict)):
        return False
    if first.get('type') != 'rule_noun' or second.get('type') != 'rule_operator' or third.get('type') != 'rule_property':
        return False
    if second.get('word') != 'is':
        return False
    first_pos = first.get('position')
    second_pos = second.get('position')
    third_pos = third.get('position')
    if not _is_position(first_pos) or not _is_position(second_pos) or (not _is_position(third_pos)):
        return False
    if second_pos[0] != first_pos[0] + dx or second_pos[1] != first_pos[1] + dy:
        return False
    if third_pos[0] != second_pos[0] + dx or third_pos[1] != second_pos[1] + dy:
        return False
    return True

def _move_objects(objects, rules, action, grid_size):
    if not isinstance(objects, list):
        return []
    if not isinstance(rules, dict):
        rules = {}
    action_delta = _action_delta(action)
    strange_words = rules.get('strange', [])
    drink_words = rules.get('drink', [])
    eat_words = rules.get('eat', [])
    grow_words = rules.get('grow', [])
    mad_words = rules.get('mad', [])
    destructive_words = rules.get('_destructive', [])
    begin_words = rules.get('begin', [])
    wake_words = rules.get('wake', [])
    grin_words = rules.get('grin', [])
    wrong_words = rules.get('wrong', [])
    if not isinstance(strange_words, list):
        strange_words = []
    if not isinstance(drink_words, list):
        drink_words = []
    if not isinstance(eat_words, list):
        eat_words = []
    if not isinstance(grow_words, list):
        grow_words = []
    if not isinstance(mad_words, list):
        mad_words = []
    if not isinstance(destructive_words, list):
        destructive_words = []
    if not isinstance(begin_words, list):
        begin_words = []
    if not isinstance(wake_words, list):
        wake_words = []
    if not isinstance(grin_words, list):
        grin_words = []
    if not isinstance(wrong_words, list):
        wrong_words = []
    if len(strange_words) == 0 and len(drink_words) == 0:
        return objects
    push_words = []
    index = 0
    while index < len(grow_words):
        word = grow_words[index]
        if word not in wake_words and word not in push_words:
            push_words.append(word)
        index += 1
    index = 0
    while index < len(mad_words):
        word = mad_words[index]
        if word not in wake_words and word not in push_words:
            push_words.append(word)
        index += 1
    blocking_words = []
    index = 0
    while index < len(eat_words):
        word = eat_words[index]
        if word not in destructive_words and word not in push_words and (word not in blocking_words):
            blocking_words.append(word)
        index += 1
    mover_entries = _build_mover_entries(objects, strange_words, drink_words, action_delta, action)
    if len(mover_entries) == 0:
        return objects
    index = 0
    while index < len(mover_entries):
        mover_entries[index]['can_move'] = _mover_can_advance(objects, mover_entries[index]['object'], mover_entries[index]['delta'], grid_size, push_words, blocking_words, destructive_words, mover_entries, [])
        index += 1
    moved_objects = []
    direct_moved_objects = []
    grin_moved_objects = []
    wake_sensitive_moved_objects = []
    ordered_entries = _ordered_mover_entries(mover_entries)
    index = 0
    while index < len(ordered_entries):
        entry = ordered_entries[index]
        obj = entry.get('object')
        delta = entry.get('delta')
        position = obj.get('position') if isinstance(obj, dict) else None
        if isinstance(obj, dict) and _is_position(position):
            next_x = position[0] + delta[0]
            next_y = position[1] + delta[1]
            if entry.get('can_move'):
                pushed_objects = []
                _shift_pushables(objects, next_x, next_y, delta, push_words, obj, pushed_objects)
                obj['position'] = [next_x, next_y]
                moved_objects.append(obj)
                direct_moved_objects.append(obj)
                grin_moved_objects.append(obj)
                push_index = 0
                while push_index < len(pushed_objects):
                    pushed_obj = pushed_objects[push_index]
                    if pushed_obj not in moved_objects:
                        moved_objects.append(pushed_obj)
                    if isinstance(pushed_obj, dict) and pushed_obj.get('type') != 'world_object' and (pushed_obj not in grin_moved_objects):
                        grin_moved_objects.append(pushed_obj)
                    push_index += 1
                if entry.get('is_strange'):
                    wake_sensitive_moved_objects.append(obj)
            else:
                if _is_in_bounds(next_x, next_y, grid_size):
                    pushables = _pushable_objects_at_position(objects, next_x, next_y, push_words, obj)
                    if len(pushables) > 0:
                        _set_pushable_directions(objects, next_x, next_y, delta, push_words, obj, [])
                if entry.get('is_drink'):
                    reverse_delta = [-delta[0], -delta[1]]
                    reverse_direction = _delta_direction(reverse_delta)
                    if isinstance(reverse_direction, str):
                        obj['direction'] = reverse_direction
        index += 1
    objects = _resolve_wake_overlaps(objects, wake_sensitive_moved_objects, wake_words)
    objects = _resolve_grin_overlaps(objects, grin_moved_objects, grin_words, wrong_words)
    objects = _resolve_begin_overlaps(objects, moved_objects, begin_words, wrong_words)
    overlap_words = []
    index = 0
    while index < len(destructive_words):
        word = destructive_words[index]
        if word not in overlap_words:
            overlap_words.append(word)
        index += 1
    return _resolve_destructive_overlaps(objects, moved_objects, overlap_words)

def _action_delta(action):
    if action == 'up':
        return [0, -1]
    if action == 'down':
        return [0, 1]
    if action == 'left':
        return [-1, 0]
    if action == 'right':
        return [1, 0]
    return None

def _action_direction(action):
    if action == 'up':
        return 'facing up'
    if action == 'down':
        return 'facing down'
    if action == 'left':
        return 'facing left'
    if action == 'right':
        return 'facing right'
    return 'facing right'

def _is_position(value):
    return isinstance(value, list) and len(value) == 2 and isinstance(value[0], int) and isinstance(value[1], int)

def _is_in_bounds(x, y, grid_size):
    if not isinstance(grid_size, list) or len(grid_size) != 2:
        return False
    width = grid_size[0]
    height = grid_size[1]
    if not isinstance(width, int) or not isinstance(height, int):
        return False
    return x >= 0 and y >= 0 and (x < width) and (y < height)

def _direction_delta(direction):
    if direction == 'facing up':
        return [0, -1]
    if direction == 'facing down':
        return [0, 1]
    if direction == 'facing left':
        return [-1, 0]
    if direction == 'facing right':
        return [1, 0]
    return None

def _object_at_position(objects, x, y, object_type):
    if not isinstance(objects, list):
        return None
    index = 0
    while index < len(objects):
        obj = objects[index]
        if isinstance(obj, dict) and obj.get('type') == object_type:
            position = obj.get('position')
            if _is_position(position) and position[0] == x and (position[1] == y):
                return obj
        index += 1
    return None

def _has_blocking_object(objects, moving_obj, x, y, blocking_words):
    if not isinstance(objects, list):
        return False
    if not isinstance(blocking_words, list) or len(blocking_words) == 0:
        return False
    index = 0
    while index < len(objects):
        obj = objects[index]
        if obj is not moving_obj and isinstance(obj, dict) and (obj.get('type') == 'world_object'):
            position = obj.get('position')
            if _is_position(position) and position[0] == x and (position[1] == y):
                if obj.get('word') in blocking_words:
                    return True
        index += 1
    return False

def _is_noun_rule_triplet(first, second, third, dx, dy):
    if not isinstance(first, dict) or not isinstance(second, dict) or (not isinstance(third, dict)):
        return False
    if first.get('type') != 'rule_noun' or second.get('type') != 'rule_operator' or third.get('type') != 'rule_noun':
        return False
    if second.get('word') != 'is':
        return False
    first_pos = first.get('position')
    second_pos = second.get('position')
    third_pos = third.get('position')
    if not _is_position(first_pos) or not _is_position(second_pos) or (not _is_position(third_pos)):
        return False
    if second_pos[0] != first_pos[0] + dx or second_pos[1] != first_pos[1] + dy:
        return False
    if third_pos[0] != second_pos[0] + dx or third_pos[1] != second_pos[1] + dy:
        return False
    return True

def _transform_objects(objects, rules):
    if not isinstance(objects, list):
        return []
    transform_rules = {}
    if isinstance(rules, dict):
        transform_rules = rules.get('_transform', {})
    if not isinstance(transform_rules, dict) or len(transform_rules) == 0:
        return objects
    result = []
    index = 0
    while index < len(objects):
        obj = objects[index]
        if isinstance(obj, dict) and obj.get('type') == 'world_object':
            target_word = transform_rules.get(obj.get('word'))
            if isinstance(target_word, str):
                obj['word'] = target_word
        result.append(obj)
        index += 1
    return result

def _nonworld_objects_at_position(objects, x, y):
    result = []
    if not isinstance(objects, list):
        return result
    index = 0
    while index < len(objects):
        obj = objects[index]
        if isinstance(obj, dict) and obj.get('type') != 'world_object':
            position = obj.get('position')
            if _is_position(position) and position[0] == x and (position[1] == y):
                result.append(obj)
        index += 1
    return result

def _can_shift_nonworld(objects, x, y, delta, grid_size):
    if not _is_in_bounds(x, y, grid_size):
        return False
    occupants = _nonworld_objects_at_position(objects, x, y)
    index = 0
    while index < len(occupants):
        position = occupants[index].get('position')
        if not _is_position(position):
            return False
        next_x = position[0] + delta[0]
        next_y = position[1] + delta[1]
        if not _can_shift_nonworld(objects, next_x, next_y, delta, grid_size):
            return False
        index += 1
    return True

def _shift_nonworld(objects, x, y, delta):
    occupants = _nonworld_objects_at_position(objects, x, y)
    index = 0
    while index < len(occupants):
        obj = occupants[index]
        position = obj.get('position')
        if _is_position(position):
            next_x = position[0] + delta[0]
            next_y = position[1] + delta[1]
            _shift_nonworld(objects, next_x, next_y, delta)
            obj['position'] = [next_x, next_y]
        index += 1

def _pushable_objects_at_position(objects, x, y, push_words, exclude_obj):
    result = []
    if not isinstance(objects, list):
        return result
    if not isinstance(push_words, list):
        push_words = []
    index = 0
    while index < len(objects):
        obj = objects[index]
        if obj is not exclude_obj and isinstance(obj, dict):
            position = obj.get('position')
            if _is_position(position) and position[0] == x and (position[1] == y):
                if obj.get('type') != 'world_object' or obj.get('word') in push_words:
                    result.append(obj)
        index += 1
    return result

def _can_shift_pushables(objects, x, y, delta, grid_size, push_words, blocking_words, destructive_words, exclude_obj, mover_entries=None, trail=None):
    if not _is_in_bounds(x, y, grid_size):
        return False
    if not isinstance(mover_entries, list):
        mover_entries = []
    if not isinstance(trail, list):
        trail = []
    occupants = _pushable_objects_at_position(objects, x, y, push_words, exclude_obj)
    index = 0
    while index < len(occupants):
        obj = occupants[index]
        position = obj.get('position') if isinstance(obj, dict) else None
        if not _is_position(position):
            return False
        next_x = position[0] + delta[0]
        next_y = position[1] + delta[1]
        if not _is_in_bounds(next_x, next_y, grid_size):
            return False
        if _has_solid_world_object(objects, obj, next_x, next_y, push_words):
            return False
        if _has_destructive_push_blocker(objects, obj, next_x, next_y, push_words, destructive_words):
            return False
        if not _can_shift_pushables(objects, next_x, next_y, delta, grid_size, push_words, blocking_words, destructive_words, obj, mover_entries, trail):
            return False
        blockers = _blocking_objects_at_position(objects, obj, next_x, next_y, blocking_words)
        blocker_index = 0
        while blocker_index < len(blockers):
            blocker = blockers[blocker_index]
            blocker_entry = _find_mover_entry(mover_entries, blocker)
            if blocker_entry is None:
                return False
            blocker_delta = blocker_entry.get('delta')
            if not isinstance(blocker_delta, list) or len(blocker_delta) != 2:
                return False
            if blocker_delta[0] != delta[0] or blocker_delta[1] != delta[1]:
                return False
            if not _mover_can_advance(objects, blocker, blocker_delta, grid_size, push_words, blocking_words, destructive_words, mover_entries, trail):
                return False
            blocker_index += 1
        index += 1
    return True

def _shift_pushables(objects, x, y, delta, push_words, exclude_obj, moved_objects):
    occupants = _pushable_objects_at_position(objects, x, y, push_words, exclude_obj)
    moved_direction = _delta_direction(delta)
    index = 0
    while index < len(occupants):
        obj = occupants[index]
        if obj not in moved_objects:
            position = obj.get('position') if isinstance(obj, dict) else None
            if _is_position(position):
                next_x = position[0] + delta[0]
                next_y = position[1] + delta[1]
                _shift_pushables(objects, next_x, next_y, delta, push_words, obj, moved_objects)
                obj['position'] = [next_x, next_y]
                if isinstance(moved_direction, str):
                    obj['direction'] = moved_direction
                moved_objects.append(obj)
        index += 1
    return objects

def _delta_direction(delta):
    if isinstance(delta, list) and len(delta) == 2:
        if delta[0] == 0 and delta[1] == -1:
            return 'facing up'
        if delta[0] == 0 and delta[1] == 1:
            return 'facing down'
        if delta[0] == -1 and delta[1] == 0:
            return 'facing left'
        if delta[0] == 1 and delta[1] == 0:
            return 'facing right'
    return None

def _resolve_eat_overlaps(objects, moved_objects, eat_words, late_words):
    if not isinstance(objects, list):
        return []
    if not isinstance(moved_objects, list) or len(moved_objects) == 0:
        return objects
    if not isinstance(eat_words, list) or not isinstance(late_words, list):
        return objects
    destructive_words = []
    index = 0
    while index < len(eat_words):
        word = eat_words[index]
        if word in late_words and word not in destructive_words:
            destructive_words.append(word)
        index += 1
    if len(destructive_words) == 0:
        return objects
    remove_objects = []
    moved_index = 0
    while moved_index < len(moved_objects):
        moved_obj = moved_objects[moved_index]
        position = moved_obj.get('position') if isinstance(moved_obj, dict) else None
        if _is_position(position):
            overlapping = []
            has_destructive = False
            index = 0
            while index < len(objects):
                obj = objects[index]
                if isinstance(obj, dict) and obj.get('type') == 'world_object':
                    obj_position = obj.get('position')
                    if _is_position(obj_position) and obj_position[0] == position[0] and (obj_position[1] == position[1]):
                        overlapping.append(obj)
                        if obj.get('word') in destructive_words:
                            has_destructive = True
                index += 1
            if has_destructive and len(overlapping) > 1:
                index = 0
                while index < len(overlapping):
                    if overlapping[index] not in remove_objects:
                        remove_objects.append(overlapping[index])
                    index += 1
        moved_index += 1
    if len(remove_objects) == 0:
        return objects
    result = []
    index = 0
    while index < len(objects):
        if objects[index] not in remove_objects:
            result.append(objects[index])
        index += 1
    return result

def _resolve_destructive_overlaps(objects, moved_objects, destructive_words):
    if not isinstance(objects, list):
        return []
    if not isinstance(moved_objects, list) or len(moved_objects) == 0:
        return objects
    if not isinstance(destructive_words, list) or len(destructive_words) == 0:
        return objects
    remove_objects = []
    moved_index = 0
    while moved_index < len(moved_objects):
        moved_obj = moved_objects[moved_index]
        position = moved_obj.get('position') if isinstance(moved_obj, dict) else None
        if _is_position(position):
            overlapping = []
            has_destructive = False
            index = 0
            while index < len(objects):
                obj = objects[index]
                if isinstance(obj, dict):
                    obj_position = obj.get('position')
                    if _is_position(obj_position) and obj_position[0] == position[0] and (obj_position[1] == position[1]):
                        overlapping.append(obj)
                        if obj.get('type') == 'world_object' and obj.get('word') in destructive_words:
                            has_destructive = True
                index += 1
            if has_destructive and len(overlapping) > 1:
                index = 0
                while index < len(overlapping):
                    if overlapping[index] not in remove_objects:
                        remove_objects.append(overlapping[index])
                    index += 1
        moved_index += 1
    if len(remove_objects) == 0:
        return objects
    result = []
    index = 0
    while index < len(objects):
        if objects[index] not in remove_objects:
            result.append(objects[index])
        index += 1
    return result

def _resolve_wake_overlaps(objects, moved_objects, wake_words):
    if not isinstance(objects, list):
        return []
    if not isinstance(moved_objects, list) or len(moved_objects) == 0:
        return objects
    if not isinstance(wake_words, list) or len(wake_words) == 0:
        return objects
    remove_objects = []
    moved_index = 0
    while moved_index < len(moved_objects):
        moved_obj = moved_objects[moved_index]
        position = moved_obj.get('position') if isinstance(moved_obj, dict) else None
        if _is_position(position):
            overlapping = []
            has_wake = False
            index = 0
            while index < len(objects):
                obj = objects[index]
                if isinstance(obj, dict) and obj.get('type') == 'world_object':
                    obj_position = obj.get('position')
                    if _is_position(obj_position) and obj_position[0] == position[0] and (obj_position[1] == position[1]):
                        overlapping.append(obj)
                        if obj.get('word') in wake_words:
                            has_wake = True
                index += 1
            if has_wake and len(overlapping) > 1:
                index = 0
                while index < len(overlapping):
                    obj = overlapping[index]
                    if obj.get('word') not in wake_words and obj not in remove_objects:
                        remove_objects.append(obj)
                    index += 1
        moved_index += 1
    if len(remove_objects) == 0:
        return objects
    result = []
    index = 0
    while index < len(objects):
        if objects[index] not in remove_objects:
            result.append(objects[index])
        index += 1
    return result

def _has_solid_world_object(objects, moving_obj, x, y, push_words):
    if not isinstance(objects, list):
        return False
    if not isinstance(push_words, list):
        push_words = []
    solid_words = ['hedge', 'pipe']
    index = 0
    while index < len(objects):
        obj = objects[index]
        if obj is not moving_obj and isinstance(obj, dict) and (obj.get('type') == 'world_object'):
            position = obj.get('position')
            if _is_position(position) and position[0] == x and (position[1] == y):
                word = obj.get('word')
                if word in solid_words and word not in push_words:
                    return True
        index += 1
    return False

def _set_pushable_directions(objects, x, y, delta, push_words, exclude_obj, updated_objects):
    occupants = _pushable_objects_at_position(objects, x, y, push_words, exclude_obj)
    direction = _delta_direction(delta)
    index = 0
    while index < len(occupants):
        obj = occupants[index]
        if obj not in updated_objects:
            updated_objects.append(obj)
            if isinstance(direction, str) and isinstance(obj, dict):
                obj['direction'] = direction
            position = obj.get('position') if isinstance(obj, dict) else None
            if _is_position(position):
                _set_pushable_directions(objects, position[0] + delta[0], position[1] + delta[1], delta, push_words, obj, updated_objects)
        index += 1
    return objects

def _has_destructive_push_blocker(objects, moving_obj, x, y, push_words, destructive_words):
    if not isinstance(objects, list):
        return False
    if not isinstance(push_words, list):
        push_words = []
    if not isinstance(destructive_words, list) or len(destructive_words) == 0:
        return False
    moving_word = None
    moving_type = None
    if isinstance(moving_obj, dict):
        moving_word = moving_obj.get('word')
        moving_type = moving_obj.get('type')
    index = 0
    while index < len(objects):
        obj = objects[index]
        if obj is not moving_obj and isinstance(obj, dict) and (obj.get('type') == 'world_object'):
            position = obj.get('position')
            if _is_position(position) and position[0] == x and (position[1] == y):
                word = obj.get('word')
                if word in destructive_words and word not in push_words:
                    if moving_type == 'world_object' and moving_word in push_words:
                        return False
                    return True
        index += 1
    return False

def _should_terminate_transition(before_objects, after_objects, rules):
    if not isinstance(before_objects, list) or not isinstance(after_objects, list) or (not isinstance(rules, dict)):
        return False
    shrink_words = rules.get('shrink', [])
    wrong_words = rules.get('wrong', [])
    if not isinstance(shrink_words, list) or len(shrink_words) == 0:
        return False
    if isinstance(wrong_words, list) and 'baba' in wrong_words:
        return False
    before_baba_positions = []
    index = 0
    while index < len(before_objects):
        obj = before_objects[index]
        if isinstance(obj, dict) and obj.get('type') == 'world_object' and (obj.get('word') == 'baba'):
            position = obj.get('position')
            if _is_position(position):
                before_baba_positions.append([position[0], position[1]])
        index += 1
    index = 0
    while index < len(after_objects):
        obj = after_objects[index]
        if isinstance(obj, dict) and obj.get('type') == 'world_object' and (obj.get('word') == 'baba'):
            position = obj.get('position')
            if _is_position(position):
                found = False
                before_index = 0
                while before_index < len(before_baba_positions):
                    before_position = before_baba_positions[before_index]
                    if before_position[0] == position[0] and before_position[1] == position[1]:
                        found = True
                        break
                    before_index += 1
                if not found:
                    overlap_index = 0
                    while overlap_index < len(after_objects):
                        overlap_obj = after_objects[overlap_index]
                        if isinstance(overlap_obj, dict) and overlap_obj is not obj and (overlap_obj.get('type') == 'world_object'):
                            overlap_position = overlap_obj.get('position')
                            if _is_position(overlap_position) and overlap_position[0] == position[0] and (overlap_position[1] == position[1]) and (overlap_obj.get('word') in shrink_words):
                                return True
                        overlap_index += 1
        index += 1
    return False

def _resolve_grin_overlaps(objects, moved_objects, grin_words, wrong_words):
    if not isinstance(objects, list):
        return []
    if not isinstance(moved_objects, list) or len(moved_objects) == 0:
        return objects
    if not isinstance(grin_words, list) or len(grin_words) == 0:
        return objects
    if not isinstance(wrong_words, list):
        wrong_words = []
    remove_objects = []
    moved_index = 0
    while moved_index < len(moved_objects):
        moved_obj = moved_objects[moved_index]
        if isinstance(moved_obj, dict) and moved_obj.get('type') == 'world_object':
            position = moved_obj.get('position')
            if _is_position(position):
                has_grin = False
                index = 0
                while index < len(objects):
                    obj = objects[index]
                    if isinstance(obj, dict) and obj.get('type') == 'world_object':
                        obj_position = obj.get('position')
                        if _is_position(obj_position) and obj_position[0] == position[0] and (obj_position[1] == position[1]):
                            if obj.get('word') in grin_words:
                                has_grin = True
                                break
                    index += 1
                if has_grin:
                    moved_word = moved_obj.get('word')
                    if moved_word not in grin_words and moved_word not in wrong_words and (moved_obj not in remove_objects):
                        if not _vacated_by_nonworld(moved_objects, position):
                            remove_objects.append(moved_obj)
        moved_index += 1
    if len(remove_objects) == 0:
        return objects
    result = []
    index = 0
    while index < len(objects):
        if objects[index] not in remove_objects:
            result.append(objects[index])
        index += 1
    return result

def _build_mover_entries(objects, strange_words, drink_words, action_delta, action):
    result = []
    index = 0
    while index < len(objects):
        obj = objects[index]
        if isinstance(obj, dict) and obj.get('type') == 'world_object':
            word = obj.get('word')
            delta = None
            is_strange = False
            is_drink = False
            if word in strange_words and action_delta is not None:
                delta = [action_delta[0], action_delta[1]]
                obj['direction'] = _action_direction(action)
                is_strange = True
            elif word in drink_words:
                direction_delta = _direction_delta(obj.get('direction'))
                if isinstance(direction_delta, list) and len(direction_delta) == 2:
                    delta = [direction_delta[0], direction_delta[1]]
                    is_drink = True
            if isinstance(delta, list) and len(delta) == 2:
                result.append({'object': obj, 'delta': delta, 'is_strange': is_strange, 'is_drink': is_drink})
        index += 1
    return result

def _find_mover_entry(mover_entries, obj):
    index = 0
    while index < len(mover_entries):
        entry = mover_entries[index]
        if entry.get('object') is obj:
            return entry
        index += 1
    return None

def _blocking_objects_at_position(objects, moving_obj, x, y, blocking_words):
    result = []
    if not isinstance(objects, list):
        return result
    if not isinstance(blocking_words, list) or len(blocking_words) == 0:
        return result
    index = 0
    while index < len(objects):
        obj = objects[index]
        if obj is not moving_obj and isinstance(obj, dict) and (obj.get('type') == 'world_object'):
            position = obj.get('position')
            if _is_position(position) and position[0] == x and (position[1] == y):
                if obj.get('word') in blocking_words:
                    result.append(obj)
        index += 1
    return result

def _mover_can_advance(objects, obj, delta, grid_size, push_words, blocking_words, destructive_words, mover_entries, trail):
    if not isinstance(obj, dict):
        return False
    position = obj.get('position')
    if not _is_position(position):
        return False
    if not isinstance(delta, list) or len(delta) != 2:
        return False
    if obj in trail:
        return False
    next_x = position[0] + delta[0]
    next_y = position[1] + delta[1]
    if not _is_in_bounds(next_x, next_y, grid_size):
        return False
    if _has_destructive_push_blocker(objects, obj, next_x, next_y, push_words, destructive_words):
        return False
    if _has_solid_world_object(objects, obj, next_x, next_y, push_words):
        return False
    next_trail = trail + [obj]
    if not _can_shift_pushables(objects, next_x, next_y, delta, grid_size, push_words, blocking_words, destructive_words, obj, mover_entries, next_trail):
        return False
    blockers = _blocking_objects_at_position(objects, obj, next_x, next_y, blocking_words)
    if len(blockers) == 0:
        return True
    index = 0
    while index < len(blockers):
        blocker = blockers[index]
        blocker_entry = _find_mover_entry(mover_entries, blocker)
        if blocker_entry is None:
            return False
        blocker_delta = blocker_entry.get('delta')
        if not isinstance(blocker_delta, list) or len(blocker_delta) != 2:
            return False
        if blocker_delta[0] != delta[0] or blocker_delta[1] != delta[1]:
            return False
        if not _mover_can_advance(objects, blocker, blocker_delta, grid_size, push_words, blocking_words, destructive_words, mover_entries, next_trail):
            return False
        index += 1
    return True

def _ordered_mover_entries(mover_entries):
    remaining = []
    index = 0
    while index < len(mover_entries):
        remaining.append(mover_entries[index])
        index += 1
    result = []
    while len(remaining) > 0:
        best_index = 0
        index = 1
        while index < len(remaining):
            if _should_move_before(remaining[index], remaining[best_index]):
                best_index = index
            index += 1
        result.append(remaining[best_index])
        del remaining[best_index]
    return result

def _should_move_before(first_entry, second_entry):
    first_obj = first_entry.get('object') if isinstance(first_entry, dict) else None
    second_obj = second_entry.get('object') if isinstance(second_entry, dict) else None
    first_delta = first_entry.get('delta') if isinstance(first_entry, dict) else None
    second_delta = second_entry.get('delta') if isinstance(second_entry, dict) else None
    first_pos = first_obj.get('position') if isinstance(first_obj, dict) else None
    second_pos = second_obj.get('position') if isinstance(second_obj, dict) else None
    if not _is_position(first_pos) or not _is_position(second_pos):
        return False
    if not isinstance(first_delta, list) or len(first_delta) != 2:
        return False
    if not isinstance(second_delta, list) or len(second_delta) != 2:
        return False
    if first_delta[0] != second_delta[0] or first_delta[1] != second_delta[1]:
        return False
    if first_delta[0] == 0 and first_delta[1] == 1:
        return first_pos[1] > second_pos[1]
    if first_delta[0] == 0 and first_delta[1] == -1:
        return first_pos[1] < second_pos[1]
    if first_delta[0] == 1 and first_delta[1] == 0:
        return first_pos[0] > second_pos[0]
    if first_delta[0] == -1 and first_delta[1] == 0:
        return first_pos[0] < second_pos[0]
    return False

def _resolve_begin_overlaps(objects, moved_objects, begin_words, wrong_words):
    if not isinstance(objects, list):
        return []
    if not isinstance(moved_objects, list) or len(moved_objects) == 0:
        return objects
    if not isinstance(begin_words, list) or len(begin_words) == 0:
        return objects
    if not isinstance(wrong_words, list):
        wrong_words = []
    remove_objects = []
    moved_index = 0
    while moved_index < len(moved_objects):
        moved_obj = moved_objects[moved_index]
        if isinstance(moved_obj, dict) and moved_obj.get('type') != 'rule_property':
            position = moved_obj.get('position')
            if _is_position(position):
                overlapping = []
                has_begin = False
                has_wrong = False
                index = 0
                while index < len(objects):
                    obj = objects[index]
                    if isinstance(obj, dict):
                        obj_position = obj.get('position')
                        if _is_position(obj_position) and obj_position[0] == position[0] and (obj_position[1] == position[1]):
                            overlapping.append(obj)
                            if obj.get('type') == 'world_object':
                                word = obj.get('word')
                                if word in begin_words:
                                    has_begin = True
                                if word in wrong_words:
                                    has_wrong = True
                    index += 1
                if has_begin and len(overlapping) > 1 and (not has_wrong):
                    index = 0
                    while index < len(overlapping):
                        if overlapping[index] not in remove_objects:
                            remove_objects.append(overlapping[index])
                        index += 1
        moved_index += 1
    if len(remove_objects) == 0:
        return objects
    result = []
    index = 0
    while index < len(objects):
        if objects[index] not in remove_objects:
            result.append(objects[index])
        index += 1
    return result

def _vacated_by_nonworld(moved_objects, position):
    if not isinstance(moved_objects, list) or not _is_position(position):
        return False
    index = 0
    while index < len(moved_objects):
        obj = moved_objects[index]
        if isinstance(obj, dict) and obj.get('type') != 'world_object':
            current_position = obj.get('position')
            if _is_position(current_position):
                delta = _direction_delta(obj.get('direction'))
                if isinstance(delta, list) and len(delta) == 2:
                    previous_x = current_position[0] - delta[0]
                    previous_y = current_position[1] - delta[1]
                    if previous_x == position[0] and previous_y == position[1]:
                        return True
        index += 1
    return False
