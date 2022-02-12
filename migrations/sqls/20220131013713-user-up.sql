CREATE TABLE app_user (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        varchar NOT NULL,
    email           varchar UNIQUE NOT NULL,
    password        varchar NOT NULL
)