const config = {schema: process.env.PGSCHEMA}

const pgp = require("pg-promise")(config)

const cn = {
    connectionString: process.env.DATABASE_URL,
    max: 20,
    ssl: process.env.ENV=='PROD' ? {rejectUnauthorized: false} : false
}

const db = pgp(cn)

module.exports = db