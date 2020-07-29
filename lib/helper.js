const shallowClone = value => {
  if (Array.isArray(value)) {
    return value.slice();
  }
  return { ...value };
};

module.exports = { shallowClone };
