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
    grid_size = next_state.get('grid_size')
    next_state['objects'] = _move_objects(transformed_objects, rules, action, grid_size)
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
    destructive_words = []
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
                            chain_properties = []
                            prop = third_property.get('word')
                            if isinstance(prop, str):
                                chain_properties.append(prop)
                                if first_word not in rules.get(prop, []):
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
                                if isinstance(prop, str):
                                    if prop not in chain_properties:
                                        chain_properties.append(prop)
                                    if first_word not in rules.get(prop, []):
                                        rules[prop] = rules.get(prop, []) + [first_word]
                                step += 2
                            if 'eat' in chain_properties and 'late' in chain_properties and (first_word not in destructive_words):
                                destructive_words.append(first_word)
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
    destructive_words = rules.get('_destructive', [])
    begin_words = rules.get('begin', [])
    wake_words = rules.get('wake', [])
    if not isinstance(strange_words, list):
        strange_words = []
    if not isinstance(drink_words, list):
        drink_words = []
    if not isinstance(eat_words, list):
        eat_words = []
    if not isinstance(grow_words, list):
        grow_words = []
    if not isinstance(destructive_words, list):
        destructive_words = []
    if not isinstance(begin_words, list):
        begin_words = []
    if not isinstance(wake_words, list):
        wake_words = []
    if len(strange_words) == 0 and len(drink_words) == 0:
        return objects
    blocking_words = []
    index = 0
    while index < len(eat_words):
        word = eat_words[index]
        if word not in destructive_words and word not in blocking_words:
            blocking_words.append(word)
        index += 1
    moved_objects = []
    wake_sensitive_moved_objects = []
    index = 0
    while index < len(objects):
        obj = objects[index]
        if isinstance(obj, dict) and obj.get('type') == 'world_object':
            word = obj.get('word')
            position = obj.get('position')
            delta = None
            is_strange_mover = False
            is_drink_mover = False
            if word in strange_words and action_delta is not None:
                delta = action_delta
                obj['direction'] = _action_direction(action)
                is_strange_mover = True
            elif word in drink_words:
                delta = _direction_delta(obj.get('direction'))
                is_drink_mover = True
            if delta is not None and _is_position(position):
                next_x = position[0] + delta[0]
                next_y = position[1] + delta[1]
                can_move = False
                if _is_in_bounds(next_x, next_y, grid_size) and (not _has_blocking_object(objects, obj, next_x, next_y, blocking_words)):
                    if not _has_solid_world_object(objects, obj, next_x, next_y, grow_words) and _can_shift_pushables(objects, next_x, next_y, delta, grid_size, grow_words, blocking_words, obj):
                        can_move = True
                if can_move:
                    pushed_objects = []
                    _shift_pushables(objects, next_x, next_y, delta, grow_words, obj, pushed_objects)
                    obj['position'] = [next_x, next_y]
                    moved_objects.append(obj)
                    push_index = 0
                    while push_index < len(pushed_objects):
                        pushed_obj = pushed_objects[push_index]
                        if pushed_obj not in moved_objects:
                            moved_objects.append(pushed_obj)
                        push_index += 1
                    if is_strange_mover:
                        wake_sensitive_moved_objects.append(obj)
                else:
                    if _is_in_bounds(next_x, next_y, grid_size):
                        pushables = _pushable_objects_at_position(objects, next_x, next_y, grow_words, obj)
                        if len(pushables) > 0:
                            _set_pushable_directions(objects, next_x, next_y, delta, grow_words, obj, [])
                    if is_drink_mover:
                        reverse_delta = [-delta[0], -delta[1]]
                        reverse_direction = _delta_direction(reverse_delta)
                        if isinstance(reverse_direction, str):
                            obj['direction'] = reverse_direction
        index += 1
    objects = _resolve_wake_overlaps(objects, wake_sensitive_moved_objects, wake_words)
    overlap_words = []
    index = 0
    while index < len(destructive_words):
        word = destructive_words[index]
        if word not in overlap_words:
            overlap_words.append(word)
        index += 1
    index = 0
    while index < len(begin_words):
        word = begin_words[index]
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

def _can_shift_pushables(objects, x, y, delta, grid_size, push_words, blocking_words, exclude_obj):
    if not _is_in_bounds(x, y, grid_size):
        return False
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
        if _has_blocking_object(objects, obj, next_x, next_y, blocking_words):
            return False
        if _has_solid_world_object(objects, obj, next_x, next_y, push_words):
            return False
        if not _can_shift_pushables(objects, next_x, next_y, delta, grid_size, push_words, blocking_words, obj):
            return False
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
