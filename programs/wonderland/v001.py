def predict_next_state(state, action):
    if not isinstance(state, dict):
        raise ValueError('state must be a dict.')
    if not isinstance(action, str):
        raise ValueError('action must be a string.')
    next_state = _copy_value(state)
    if not isinstance(next_state, dict):
        return {}
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
