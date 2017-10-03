module.exports = {
  extends: [
    "lddubeau-base"
  ],
  env: {
    node: true,
  },
  rules: {
    "no-continue": "off",
    "import/no-extraneous-dependencies": "off",
    "import/no-unresolved": "off",
    "no-mixed-operators": [
      "error",
      { "allowSamePrecedence": true },
    ],
  }
};
