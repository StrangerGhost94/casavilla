-- Audit trail: who (name and level, kept even if the account is later removed), why, whether it was signed with a
-- password, what changed (before/after), and a hash chain so any edited or missing entry can be detected.
ALTER TABLE "audit_logs"
  ADD COLUMN "actor_name" TEXT,
  ADD COLUMN "actor_role" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "signed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB,
  ADD COLUMN "seq" BIGINT,
  ADD COLUMN "prev_hash" TEXT,
  ADD COLUMN "hash" TEXT;

CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- The text each entry's hash is made from. actor_id is left out on purpose: it is cleared if an account is deleted.
CREATE FUNCTION audit_row_hash(r audit_logs) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(concat_ws('|',
    r.seq::text, coalesce(r.prev_hash, ''), coalesce(r.actor_name, ''), coalesce(r.actor_role, ''),
    r.action, r.entity, coalesce(r.entity_id::text, ''), coalesce(r.detail, ''), coalesce(r.reason, ''), r.signed::text,
    coalesce(r.before::text, ''), coalesce(r.after::text, ''),
    to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US')), 'UTF8')), 'hex')
$$;

-- Every new entry: who did it (name and level at that moment), its place in the chain, and its hash.
CREATE FUNCTION audit_logs_seal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last audit_logs;
BEGIN
  PERFORM pg_advisory_xact_lock(7340021);
  IF NEW.actor_id IS NOT NULL THEN
    SELECT u.name, CASE WHEN u.role = 'manager' THEN (CASE WHEN u.super_admin THEN 'super admin' ELSE 'office staff' END) ELSE u.role::text END
      INTO NEW.actor_name, NEW.actor_role FROM users u WHERE u.id = NEW.actor_id;
  ELSE
    NEW.actor_name := coalesce(NEW.actor_name, 'System');
    NEW.actor_role := coalesce(NEW.actor_role, 'system');
  END IF;
  SELECT * INTO last FROM audit_logs ORDER BY seq DESC NULLS LAST LIMIT 1;
  NEW.seq := coalesce(last.seq, 0) + 1;
  NEW.prev_hash := last.hash;
  NEW.hash := audit_row_hash(NEW);
  RETURN NEW;
END $$;

-- Entries can never be edited or deleted. The one exception: when an account is deleted, its id is cleared
-- (the name stays on the entry).
CREATE FUNCTION audit_logs_freeze() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'The audit trail cannot be changed or deleted';
END $$;

-- Existing entries join the chain in the order they were made.
DO $$
DECLARE r audit_logs; prev TEXT; n BIGINT := 0;
BEGIN
  FOR r IN SELECT * FROM audit_logs ORDER BY id LOOP
    n := n + 1;
    UPDATE audit_logs a SET
      actor_name = coalesce((SELECT u.name FROM users u WHERE u.id = r.actor_id), 'System'),
      actor_role = coalesce((SELECT CASE WHEN u.role = 'manager' THEN (CASE WHEN u.super_admin THEN 'super admin' ELSE 'office staff' END) ELSE u.role::text END FROM users u WHERE u.id = r.actor_id), 'system'),
      seq = n, prev_hash = prev
    WHERE a.id = r.id;
    UPDATE audit_logs a SET hash = audit_row_hash(a) WHERE a.id = r.id RETURNING a.hash INTO prev;
  END LOOP;
END $$;

CREATE UNIQUE INDEX "audit_logs_seq_key" ON "audit_logs"("seq");
CREATE TRIGGER audit_logs_seal BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_seal();
CREATE TRIGGER audit_logs_freeze BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_freeze();
