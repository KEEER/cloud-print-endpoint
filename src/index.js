require('dotenv').config()
require('esm')(module, { cjs: { dedefault: true } })('./main')
