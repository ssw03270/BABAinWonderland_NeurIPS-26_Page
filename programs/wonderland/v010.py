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
    if not isinstance(objects, list):
        return rules
    index = 0
    while index < len(objects):
        first = objects[index]
        if isinstance(first, dict) and first.get('type') == 'rule_noun':
            first_pos = first.get('position')
            if _is_position(first_pos):
                direction_index = 0
                directions = [[1, 0], [0, 1]]
                while direction_index < len(directions):
                    dx = directions[direction_index][0]
                    dy = directions[direction_index][1]
                    second = _object_at_position(objects, first_pos[0] + dx, first_pos[1] + dy, 'rule_operator')
                    if isinstance(second, dict) and second.get('word') == 'is':
                        third = _object_at_position(objects, first_pos[0] + 2 * dx, first_pos[1] + 2 * dy, 'rule_property')
                        if _is_rule_triplet(first, second, third, dx, dy):
                            word = first.get('word')
                            prop = third.get('word')
                            if isinstance(word, str) and isinstance(prop, str) and (word not in rules.get(prop, [])):
                                rules[prop] = rules.get(prop, []) + [word]
                        else:
                            third = _object_at_position(objects, first_pos[0] + 2 * dx, first_pos[1] + 2 * dy, 'rule_noun')
                            if _is_noun_rule_triplet(first, second, third, dx, dy):
                                source_word = first.get('word')
                                target_word = third.get('word')
                                if isinstance(source_word, str) and isinstance(target_word, str):
                                    transforms[source_word] = target_word
                    direction_index += 1
        index += 1
    if len(transforms) > 0:
        rules['_transform'] = transforms
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
    blocking_words = rules.get('eat', [])
    grow_words = rules.get('grow', [])
    if not isinstance(strange_words, list):
        strange_words = []
    if not isinstance(drink_words, list):
        drink_words = []
    if not isinstance(blocking_words, list):
        blocking_words = []
    if not isinstance(grow_words, list):
        grow_words = []
    if len(strange_words) == 0 and len(drink_words) == 0:
        return objects
    index = 0
    while index < len(objects):
        obj = objects[index]
        if isinstance(obj, dict) and obj.get('type') == 'world_object':
            word = obj.get('word')
            position = obj.get('position')
            delta = None
            if word in strange_words and action_delta is not None:
                delta = action_delta
                obj['direction'] = _action_direction(action)
            elif word in drink_words:
                delta = _direction_delta(obj.get('direction'))
            if delta is not None and _is_position(position):
                next_x = position[0] + delta[0]
                next_y = position[1] + delta[1]
                if _is_in_bounds(next_x, next_y, grid_size) and (not _has_blocking_object(objects, obj, next_x, next_y, blocking_words)):
                    if _can_shift_pushables(objects, next_x, next_y, delta, grid_size, grow_words, blocking_words, obj):
                        _shift_pushables(objects, next_x, next_y, delta, grow_words, obj, [])
                        obj['position'] = [next_x, next_y]
        index += 1
    return objects

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
        if obj.get('type') == 'world_object' and _has_blocking_object(objects, obj, next_x, next_y, blocking_words):
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
                if obj.get('type') == 'world_object' and isinstance(moved_direction, str):
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
