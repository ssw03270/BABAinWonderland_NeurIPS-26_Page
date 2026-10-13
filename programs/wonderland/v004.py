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
    grid_size = next_state.get('grid_size')
    next_state['objects'] = _move_objects(objects, rules, action, grid_size)
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
    if not isinstance(objects, list):
        return rules
    index = 0
    while index < len(objects):
        first = objects[index]
        second = objects[index + 1] if index + 1 < len(objects) else None
        third = objects[index + 2] if index + 2 < len(objects) else None
        if _is_rule_triplet(first, second, third, 1, 0):
            word = first.get('word')
            prop = third.get('word')
            if word not in rules.get(prop, []):
                rules[prop] = rules.get(prop, []) + [word]
        index += 1
    index = 0
    while index < len(objects):
        first = objects[index]
        second = objects[index + 1] if index + 1 < len(objects) else None
        third = objects[index + 2] if index + 2 < len(objects) else None
        if _is_rule_triplet(first, second, third, 0, 1):
            word = first.get('word')
            prop = third.get('word')
            if word not in rules.get(prop, []):
                rules[prop] = rules.get(prop, []) + [word]
        index += 1
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
    if not isinstance(strange_words, list):
        strange_words = []
    if not isinstance(drink_words, list):
        drink_words = []
    if len(strange_words) == 0 and len(drink_words) == 0:
        return objects
    result = []
    index = 0
    while index < len(objects):
        obj = objects[index]
        if isinstance(obj, dict) and obj.get('type') == 'world_object':
            word = obj.get('word')
            position = obj.get('position')
            delta = None
            if word in strange_words and action_delta is not None:
                delta = action_delta
            elif word in drink_words:
                delta = _direction_delta(obj.get('direction'))
            if delta is not None and _is_position(position):
                next_x = position[0] + delta[0]
                next_y = position[1] + delta[1]
                if _is_in_bounds(next_x, next_y, grid_size):
                    obj['position'] = [next_x, next_y]
                    if word in strange_words and action_delta is not None:
                        obj['direction'] = _action_direction(action)
        result.append(obj)
        index += 1
    return result

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
