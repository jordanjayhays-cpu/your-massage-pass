-- Strict assertions for the fixed state (studio-photos + avatars migrations applied).
-- psql var: :sc scenario name
\set A 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set B 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set AP 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/avatar.jpg'
\set BP 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar.jpg'

-- Owner can upsert, overwrite and update their own avatar (Profile.tsx handlePhotoSelect).
select t.expect(:'sc', '01 owner upsert new avatar', t.act(:'A', t.upsert('avatars', :'AP', :'A', 'a1')), 'ok:1');
select t.expect(:'sc', '01 ...version', t.ver('avatars', :'AP'), 'a1');
select t.expect(:'sc', '02 owner upsert overwrite own avatar', t.act(:'A', t.upsert('avatars', :'AP', :'A', 'a2')), 'ok:1');
select t.expect(:'sc', '02 ...version', t.ver('avatars', :'AP'), 'a2');
select t.expect(:'sc', '03 owner plain update own avatar', t.act(:'A', t.upd('avatars', :'AP', 'a3')), 'ok:1');
select t.expect(:'sc', '03 ...version', t.ver('avatars', :'AP'), 'a3');
select t.expect(:'sc', '04 attacker upsert own avatar', t.act(:'B', t.upsert('avatars', :'BP', :'B', 'b1')), 'ok:1');

-- Attacker cannot write, overwrite, move into, plant in, or delete from the victim's folder.
select t.expect(:'sc', '05 attacker upsert over victim avatar', t.act(:'B', t.upsert('avatars', :'AP', :'B', 'evil')), 'err:42501%');
select t.expect(:'sc', '05 ...victim version unchanged', t.ver('avatars', :'AP'), 'a3');
select t.expect(:'sc', '06 attacker plain update victim avatar', t.act(:'B', t.upd('avatars', :'AP', 'evil')), 'ok:0');
select t.expect(:'sc', '06 ...victim version unchanged', t.ver('avatars', :'AP'), 'a3');
select t.expect(:'sc', '07 attacker renames own object into victim folder', t.act(:'B', t.mv('avatars', :'BP', :'A' || '/moved.jpg')), 'err:42501%');
select t.expect(:'sc', '07 ...attacker object still at own path', t.ver('avatars', :'BP'), 'b1');
select t.expect(:'sc', '08 attacker inserts new file in victim folder', t.act(:'B', t.ins('avatars', :'A' || '/planted.jpg', :'B', 'evil')), 'err:42501%');
select t.expect(:'sc', '08 ...file absent', t.ver('avatars', :'A' || '/planted.jpg'), 'absent');
select t.expect(:'sc', '09 attacker inserts at bucket root (no folder)', t.act(:'B', t.ins('avatars', 'avatar.jpg', :'B', 'evil')), 'err:42501%');
select t.expect(:'sc', '10 attacker deletes victim avatar', t.act(:'B', t.del('avatars', :'AP')), 'ok:0');
select t.expect(:'sc', '10 ...victim avatar still there', t.ver('avatars', :'AP'), 'a3');

-- Anonymous callers cannot write; public read still works for everyone.
select t.expect(:'sc', '11 anon upsert victim avatar', t.act(null, t.upsert('avatars', :'AP', null, 'evil')), 'err:42501%');
select t.expect(:'sc', '11 anon update victim avatar', t.act(null, t.upd('avatars', :'AP', 'evil')), 'ok:0');
select t.expect(:'sc', '11 anon delete victim avatar', t.act(null, t.del('avatars', :'AP')), 'ok:0');
select t.expect(:'sc', '11 ...victim version unchanged', t.ver('avatars', :'AP'), 'a3');
select t.expect(:'sc', '12 anon can read victim avatar row (public bucket)', t.act(null, t.sel('avatars', :'AP')), 'ok:1');
select t.expect(:'sc', '12 attacker can read victim avatar row', t.act(:'B', t.sel('avatars', :'AP')), 'ok:1');

-- Owner remove() (Profile.tsx handlePhotoRemove) now actually deletes.
select t.expect(:'sc', '13 direct delete without Storage API flag is blocked by trigger', t.act(:'A', t.del('avatars', :'AP'), false), 'err:42501%');
select t.expect(:'sc', '13 ...still present', t.ver('avatars', :'AP'), 'a3');
select t.expect(:'sc', '14 owner remove own avatar', t.act(:'A', t.del('avatars', :'AP')), 'ok:1');
select t.expect(:'sc', '14 ...gone', t.ver('avatars', :'AP'), 'absent');
select t.expect(:'sc', '15 owner remove again is a no-op, not an error', t.act(:'A', t.del('avatars', :'AP')), 'ok:0');
select t.expect(:'sc', '16 owner re-upload after remove', t.act(:'A', t.upsert('avatars', :'AP', :'A', 'a4')), 'ok:1');
select t.expect(:'sc', '16 ...version', t.ver('avatars', :'AP'), 'a4');

-- Neighbouring buckets behave as the studio-photos migration intends.
select t.expect(:'sc', '17 attacker upsert own studio-photos folder', t.act(:'B', t.upsert('studio-photos', :'B' || '/cover.jpg', :'B', 's1')), 'ok:1');
select t.expect(:'sc', '17 attacker upsert victim studio-photos folder', t.act(:'B', t.upsert('studio-photos', :'A' || '/cover.jpg', :'B', 's1')), 'err:42501%');
select t.expect(:'sc', '18 attacker write private wa-media', t.act(:'B', t.ins('wa-media', :'B' || '/x.jpg', :'B', 'w1')), 'err:42501%');

-- Final avatars policy set.
select t.expect(:'sc', '19 avatars policies after migration',
  (select string_agg(policyname || ':' || cmd, ',' order by policyname) from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars%'),
  'avatars_own_delete:DELETE,avatars_own_insert:INSERT,avatars_own_update:UPDATE,avatars_public_read:SELECT');
