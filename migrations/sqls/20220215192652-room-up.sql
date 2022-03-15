CREATE TYPE room_status AS ENUM('WAITING', 'ACTIVE', 'DONE');

ALTER TABLE app_user ALTER COLUMN money SET NOT NULL;

CREATE TABLE room (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    active_id               VARCHAR(5) NOT NULL,
    deck                    VARCHAR(2)[] NOT NULL,
    status                  room_status NOT NULL,
    pot                     INTEGER NOT NULL DEFAULT 0,
    big_blind               INTEGER NOT NULL,
    small_blind             INTEGER NOT NULL,
    owner                   UUID NOT NULL,
    players                 JSONB NOT NULL,
    action_start_time       TIMESTAMP WITHOUT TIME ZONE,
    action_max_time         INTEGER NOT NULL,
    turn                    INTEGER,
    community_cards         VARCHAR(2)[],
    max_players             INTEGER NOT NULL,
    num_players             INTEGER NOT NULL,
    max_action              INTEGER,
    buy_in                  INTEGER NOT NULL,
    
    CONSTRAINT fk_owner
        FOREIGN KEY (owner)
            REFERENCES app_user(id)
)