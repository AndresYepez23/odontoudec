// Disposable PostgreSQL only. No connection URL or production data is accepted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.ODONTO_TEST_TOOLS||'.','package.json'));
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
const migration=readFileSync(new URL('../supabase/migrations/20261123163935_security_privileges_and_bot_quotas.sql',import.meta.url),'utf8');
const read=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
let checks=0;
const eq=(x,y)=>{assert.deepEqual(x,y);checks++;};
const denied=async sql=>{await assert.rejects(db.exec(sql),/permission denied|row-level security/);checks++;};
try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 CREATE TABLE profiles(id uuid PRIMARY KEY, display_name text, public_id text, semester smallint);
 CREATE TABLE user_roles(user_id uuid PRIMARY KEY,role text);
 ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(SELECT auth.uid()) AND role='admin') $$;
 REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
 INSERT INTO auth.users VALUES('${a}'),('${b}'),('${c}');
 INSERT INTO profiles(id,display_name) SELECT id,'Synthetic user' FROM auth.users;`);
 await db.exec(read('20261103010000_profile_privacy_controls.sql'));
 const messages=read('20261030000000_usernames_private_messaging.sql');
 await db.exec(messages.slice(messages.indexOf('-- Private conversations.')));
 const notes=read('20261101010000_student_workspace.sql');
 await db.exec(notes.slice(0,notes.indexOf('create table if not exists public.resource_collections')));
 await db.exec(read('20261103132948_patient_bank.sql'));
 await db.exec(read('20261103141000_relax_patient_bank_intake_validation.sql'));
 await db.exec(read('20261103160000_remove_patient_bank_pending_review.sql'));
 // Remaining tables need only grant fixtures; authorization checks target real migrations above.
 const tableNames=[...migration.split('FROM anon, authenticated;')[0].matchAll(/public\.([a-z_]+)/g)].map(x=>x[1]);
 for(const table of tableNames){
  await db.exec(`CREATE TABLE IF NOT EXISTS public.${table}(id integer); GRANT ALL ON public.${table} TO anon,authenticated;`);
 }
 const policies=(await db.query('SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname')).rows;
 await db.exec(migration);await db.exec(migration);
 eq((await db.query("SELECT * FROM pg_policies WHERE tablename <> 'odonto_bot_limits' ORDER BY schemaname,tablename,policyname")).rows,policies);
 for(const table of tableNames)for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']){
  const result=await db.query('SELECT has_table_privilege($1,$2,$3) AS ok',[role,table,privilege]);
  eq(result.rows[0].ok,['SELECT','INSERT','UPDATE','DELETE'].includes(privilege));
 }
 await db.exec(`UPDATE profiles SET profile_visibility='private' WHERE id='${b}';
 INSERT INTO student_notes(user_id,title,content) VALUES('${a}','A note','A'),('${b}','B note','B');
 INSERT INTO private_conversations(id,user_one,user_two) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${a}','${b}');
 INSERT INTO private_messages(conversation_id,sender_id,content) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${a}','Synthetic message');
 INSERT INTO patient_bank_cases(id,reason_summary,source,consent_recorded) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic reason','patient',true);
 INSERT INTO patient_bank_private(case_id,patient_name,phone) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic patient','123456789');`);
 for(const [user,other] of [[a,b],[b,a]]){
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}';`);
  eq((await db.query('SELECT user_id FROM student_notes')).rows,[{user_id:user}]);
  eq((await db.query(`UPDATE student_notes SET content='forbidden' WHERE user_id='${other}' RETURNING id`)).rows.length,0);
  eq((await db.query(`DELETE FROM student_notes WHERE user_id='${other}' RETURNING id`)).rows.length,0);
  await denied(`INSERT INTO student_notes(user_id,title) VALUES('${other}','not mine')`);
  eq((await db.query(`UPDATE student_notes SET content='own' WHERE user_id='${user}' RETURNING id`)).rows.length,1);
  eq((await db.query('SELECT * FROM private_messages')).rows.length,1);
  await denied('SELECT * FROM patient_bank_private');
  eq((await db.query("UPDATE user_roles SET role='admin' RETURNING user_id")).rows.length,0);
  await db.exec('RESET ROLE');
 }
 await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${c}';`);
 eq((await db.query('SELECT * FROM private_messages')).rows.length,0);
 eq((await db.query(`SELECT * FROM profiles WHERE id='${b}'`)).rows.length,0);
 await denied(`INSERT INTO private_messages(conversation_id,sender_id,content) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${c}','intrusion')`);
 await denied(`INSERT INTO user_roles VALUES('${c}','admin')`);
 await denied(`SELECT public.reserve_odonto_bot_request('${c}')`);
 eq((await db.query("SELECT * FROM patient_bank_my_contact('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')")).rows.length,0);
 await db.exec(`SET request.jwt.claim.sub='${a}';`);
 eq((await db.query("SELECT patient_bank_claim_case('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') AS ok")).rows[0].ok,true);
 eq((await db.query("SELECT * FROM patient_bank_my_contact('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')")).rows.length,1);
 await db.exec(`SET request.jwt.claim.sub='${b}';`);
 eq((await db.query("SELECT * FROM patient_bank_my_contact('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')")).rows.length,0);
 eq((await db.query("SELECT patient_bank_release_case('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') AS ok")).rows[0].ok,false);
 await db.exec('RESET ROLE; SET ROLE anon');
 await denied(`SELECT public.reserve_odonto_bot_request('${a}')`);
 eq((await db.query('SELECT * FROM private_messages')).rows.length,0);
 await db.exec('RESET ROLE; SET ROLE service_role');
 const quota=async user=>(await db.query('SELECT reserve_odonto_bot_request($1) AS result',[user])).rows[0].result;
 const attempts=await Promise.all(Array.from({length:12},()=>quota(a)));
 eq(attempts.filter(x=>x.allowed).length,6);eq(attempts.filter(x=>!x.allowed).length,6);
 await db.exec('RESET ROLE');
 // Simulate remaining daily usage without waiting or touching production.
 await db.exec(`DELETE FROM private.odonto_bot_limits WHERE scope LIKE 'user-minute:%'; UPDATE private.odonto_bot_limits SET request_count=40 WHERE scope='user-day:${a}'; SET ROLE service_role;`);
 eq((await quota(a)).allowed,false);
 await db.exec("RESET ROLE; UPDATE private.odonto_bot_limits SET request_count=200 WHERE scope='global-day'; SET ROLE service_role;");
 eq((await quota(c)).allowed,false);
 console.log(`PASS: ${checks} PostgreSQL privilege, privacy and quota assertions; synthetic data only.`);
}finally{await db.close();}
