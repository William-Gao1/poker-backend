const config = {schema: process.env.PGSCHEMA}

const pgp = require("pg-promise")(config)

const cn = process.env.DATABASE_URL

const db = pgp(cn)

module.exports = db