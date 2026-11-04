-- Owner portal logins: map users to one or more owners (their trucks only).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN', 'MANAGER', 'TRANSPORT_USER', 'OWNER'));

CREATE TABLE IF NOT EXISTS user_owners (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_user_owners_owner ON user_owners(owner_id);

-- Managers created by an owner login, linked to that owner's fleet.
CREATE TABLE IF NOT EXISTS manager_owners (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_owners_owner ON manager_owners(owner_id);
