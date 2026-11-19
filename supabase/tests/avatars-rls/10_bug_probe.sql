-- Three probes whose outcome shows which policy set is effective.
-- psql vars: :sc scenario name, :want_overwrite, :want_newfile, :want_remove
\set A 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set B 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

-- Seed: victim A already has an avatar (inserted as superuser).
insert into storage.objects (bucket_id, name, owner, owner_id, version)
values ('avatars', :'A' || '/avatar.jpg', :'A', :'A', 'v1');

-- Probe 1: attacker B upserts over A's avatar. Result = A's avatar version afterwards.
select t.act(:'B', t.upsert('avatars', :'A' || '/avatar.jpg', :'B', 'evil')) \gset p1_
select t.expect(:'sc', 'attacker upsert over victim avatar -> victim version', t.ver('avatars', :'A' || '/avatar.jpg'), :'want_overwrite');

-- Probe 2: attacker B creates a new object in A's folder.
select t.act(:'B', t.ins('avatars', :'A' || '/planted.jpg', :'B', 'evil')) \gset p2_
select t.expect(:'sc', 'attacker new file in victim folder -> exists?', t.ver('avatars', :'A' || '/planted.jpg'), :'want_newfile');

-- Probe 3: owner A removes own avatar. Result = rows deleted.
select t.expect(:'sc', 'owner remove() own avatar -> rows deleted', t.act(:'A', t.del('avatars', :'A' || '/avatar.jpg')), :'want_remove');
