/**
 * ESTARA — AUTHORIZATION TEST SUITE
 *
 * Proves that security lives in the database, not the React app. Each block
 * impersonates a role exactly the way PostgREST does — `set role` plus
 * `request.jwt.claims` — so these are the same policies a real browser request
 * hits. Every assertion runs inside a transaction that is rolled back, so the
 * suite is safe to run against seeded data repeatedly.
 *
 * Run:  DATABASE_URL='...' node supabase/tests/authorization.test.cjs
 */
const { Client } = require('pg');
// Connection string comes from the environment — never hard-code credentials.
//   DATABASE_URL='postgresql://postgres.<ref>:<pw>@<pooler-host>:5432/postgres' \
//     node supabase/tests/authorization.test.cjs
const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error('Set DATABASE_URL (Supabase → Settings → Database → Connection string → Session pooler).');
  process.exit(2);
}
const c = new Client({ connectionString: URL, ssl:{rejectUnauthorized:false} });

let pass=0, fail=0;
function ok(n,c_){ (c_?pass++:fail++); console.log((c_?'  PASS  ':'  FAIL  ')+n); }

// Impersonate exactly like PostgREST: role + JWT claims.
async function as(uid, fn) {
  await c.query('begin');
  try {
    await c.query(`set local role authenticated`);
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({sub:uid, role:'authenticated'})]);
    return await fn();
  } finally { await c.query('rollback'); }
}
async function asAnon(fn) {
  await c.query('begin');
  try {
    await c.query(`set local role anon`);
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({role:'anon'})]);
    return await fn();
  } finally { await c.query('rollback'); }
}
// Each probe runs in a savepoint: a rejected write aborts the surrounding
// transaction otherwise, and every later assertion would fail spuriously.
let sp = 0;
// "Denied" means the write had no effect: either RLS/a trigger raised, or the
// policy filtered every candidate row so 0 rows changed. Both are a block.
const denied = async (p) => {
  const n = 'sp' + (++sp);
  await c.query('savepoint ' + n);
  try {
    const r = await p();
    await c.query('rollback to savepoint ' + n);
    return r && typeof r.rowCount === 'number' ? r.rowCount === 0 : false;
  } catch {
    await c.query('rollback to savepoint ' + n);
    return true;
  }
};
// "Allowed" means it actually changed something and did not raise.
const allowed = async (p) => {
  const n = 'sp' + (++sp);
  await c.query('savepoint ' + n);
  try {
    const r = await p();
    await c.query('rollback to savepoint ' + n);
    return !r || typeof r.rowCount !== 'number' || r.rowCount > 0;
  } catch {
    await c.query('rollback to savepoint ' + n);
    return false;
  }
};

(async()=>{
await c.connect();
const u = {};
for (const e of ['demo.customer@estara.test','demo.customer2@estara.test','demo.agent@estara.test','demo.agent3@estara.test','demo.admin@estara.test'])
  u[e] = (await c.query('select id from auth.users where email=$1',[e])).rows[0].id;
const CUST=u['demo.customer@estara.test'], CUST2=u['demo.customer2@estara.test'],
      AG1=u['demo.agent@estara.test'], AG3=u['demo.agent3@estara.test'], ADM=u['demo.admin@estara.test'];

const pubProp = (await c.query("select id,agent_id from properties where status='published' and city='Lekki' limit 1")).rows[0];
const draft   = (await c.query("select id from properties where status='draft' limit 1")).rows[0];
const pending = (await c.query("select id from properties where status='pending_review' limit 1")).rows[0];
const ag1row  = (await c.query("select a.id from agents a join profiles p on p.id=a.profile_id join auth.users x on x.id=p.auth_user_id where x.email='demo.agent@estara.test'")).rows[0];
const ag2row  = (await c.query("select a.id from agents a join profiles p on p.id=a.profile_id join auth.users x on x.id=p.auth_user_id where x.email='demo.agent2@estara.test'")).rows[0];
const ag2prop = (await c.query("select id from properties where agent_id=$1 limit 1",[ag2row.id])).rows[0];
const ag3row  = (await c.query("select a.id from agents a join profiles p on p.id=a.profile_id join auth.users x on x.id=p.auth_user_id where x.email='demo.agent3@estara.test'")).rows[0];
// A published property the demo customer has NOT already favourited.
const freshProp = (await c.query(`select id from properties where status='published'
  and id not in (select property_id from favorites) limit 1`)).rows[0];

console.log('\n--- ANONYMOUS ---');
await asAnon(async()=>{
  ok('anon sees only published listings',
    (await c.query("select count(*) n from properties where status<>'published'")).rows[0].n==='0');
  ok('anon sees all 14 published', (await c.query("select count(*) n from properties")).rows[0].n==='14');
  ok('anon CANNOT read profiles', (await c.query("select count(*) n from profiles")).rows[0].n==='0');
  ok('anon can read public_agents view', Number((await c.query("select count(*) n from public_agents")).rows[0].n)>0);
  ok('anon CANNOT insert a property', await denied(()=>c.query(
     "insert into properties (agent_id,title,description,property_type,listing_type,price,country,state_region,city) values ($1,'x','y','house','sale',1,'a','b','c')",[ag1row.id])));
  ok('anon CANNOT read inquiries', (await c.query("select count(*) n from inquiries")).rows[0].n==='0');
});

console.log('\n--- CUSTOMER ---');
await as(CUST, async()=>{
  ok('customer reads own profile only', (await c.query("select count(*) n from profiles")).rows[0].n==='1');
  ok('customer sees own favourites (3)', (await c.query("select count(*) n from favorites")).rows[0].n==='3');
  ok('customer sees own inquiries only',
    (await c.query("select count(*) n from inquiries")).rows[0].n==='2');
  ok('customer CANNOT see draft listings',
    (await c.query("select count(*) n from properties where status<>'published'")).rows[0].n==='0');
  ok('customer CANNOT escalate to admin', await denied(()=>c.query("update profiles set role='admin' where auth_user_id=$1",[CUST])));
  ok('customer CANNOT change own status', await denied(()=>c.query("update profiles set status='deactivated' where auth_user_id=$1",[CUST])));
  ok('customer CANNOT create a property', await denied(()=>c.query(
     "insert into properties (agent_id,title,description,property_type,listing_type,price,country,state_region,city) values ($1,'x','y','house','sale',1,'a','b','c')",[ag1row.id])));
  ok('customer CANNOT publish a listing', await denied(()=>c.query("update properties set status='published' where id=$1",[pending.id])));
  ok('customer CANNOT verify an agent', await denied(()=>c.query("update agents set verification_status='verified' where id=$1",[ag1row.id])));
  ok('customer CANNOT read another customer favourites',
     (await c.query("select count(*) n from favorites where user_id<>(select id from profiles where auth_user_id=$1)",[CUST])).rows[0].n==='0');
  ok('customer CAN favourite a new property', await allowed(()=>c.query(
     "insert into favorites (user_id,property_id) values ((select id from profiles where auth_user_id=$1),$2)",[CUST, freshProp.id])));
});

console.log('\n--- AGENT (verified, agent1) ---');
await as(AG1, async()=>{
  ok('agent sees own drafts + published', Number((await c.query("select count(*) n from properties where agent_id=$1",[ag1row.id])).rows[0].n)===9);
  ok('agent CANNOT see another agent unpublished', (await c.query(
     "select count(*) n from properties where agent_id<>$1 and status<>'published'",[ag1row.id])).rows[0].n==='0');
  ok('agent CANNOT edit another agent listing', (await c.query(
     "update properties set title='hacked' where id=$1 returning id",[ag2prop.id])).rowCount===0);
  ok('agent CANNOT approve own listing (draft->published)',
     await denied(()=>c.query("update properties set status='published' where id=$1",[draft.id])));
  ok('agent CANNOT approve own listing (pending->published)',
     await denied(()=>c.query("update properties set status='published' where id=$1",[pending.id])));
  ok('agent CAN submit draft -> pending_review',
     await allowed(()=>c.query("update properties set status='pending_review' where id=$1",[draft.id])));
  // Meaningful only from a non-verified state: reset to rejected first, then
  // attempt the escalation the guard is supposed to stop.
  ok('agent CANNOT self-verify from rejected', await denied(async()=>{
     await c.query("set local role postgres");
     await c.query("update agents set verification_status='rejected' where id=$1",[ag1row.id]);
     await c.query("set local role authenticated");
     return c.query("update agents set verification_status='verified' where id=$1",[ag1row.id]);
  }));
  ok('agent CANNOT verify another agent', await denied(()=>c.query("update agents set verification_status='verified' where id=$1",[ag2row.id])));
  ok('agent sees own inquiries only', (await c.query("select count(*) n from inquiries")).rows[0].n==='2');
  ok('agent CANNOT read customer profiles wholesale',
     Number((await c.query("select count(*) n from profiles")).rows[0].n) <= 3);
});

console.log('\n--- AGENT (unverified, agent3) ---');
await as(AG3, async()=>{
  const ag3 = (await c.query("select current_agent_id() id")).rows[0].id;
  ok('unverified agent CANNOT insert a property', await denied(()=>c.query(
     "insert into properties (agent_id,title,description,property_type,listing_type,price,country,state_region,city) values ($1,'x','yyyyyyyyyy','house','sale',1,'a','b','c')",[ag3])));
  ok('unverified agent CANNOT jump straight to verified',
     await denied(()=>c.query("update agents set verification_status='verified' where id=$1",[ag3])));
});

console.log('\n--- ADMIN ---');
await as(ADM, async()=>{
  ok('admin sees all profiles (6)', (await c.query("select count(*) n from profiles")).rows[0].n==='6');
  ok('admin sees all properties (16)', (await c.query("select count(*) n from properties")).rows[0].n==='16');
  ok('admin sees all reports', Number((await c.query("select count(*) n from reports")).rows[0].n)>0);
  ok('admin CAN publish a pending listing',
     await allowed(()=>c.query("update properties set status='published' where id=$1",[pending.id])));
  ok('admin CAN reject with a reason',
     await allowed(()=>c.query("update properties set status='rejected', rejection_reason='test' where id=$1",[pending.id])));
  ok('admin CAN verify a pending agent', await allowed(async()=>{
     await c.query("set local role postgres");
     await c.query("update agents set verification_status='pending' where id=$1",[ag3row.id]);
     await c.query("set local role authenticated");
     return c.query("update agents set verification_status='verified' where id=$1",[ag3row.id]);
  }));
  ok('admin CAN suspend a user', await allowed(()=>c.query("update profiles set status='suspended' where auth_user_id=$1",[CUST2])));
});

console.log('\n--- SUSPENDED USER ---');
await c.query("update profiles set status='suspended' where auth_user_id=$1",[CUST]);
await as(CUST, async()=>{
  ok('suspended user CANNOT favourite', await denied(()=>c.query(
     "insert into favorites (user_id,property_id) values ((select id from profiles where auth_user_id=$1),$2)",[CUST, draft.id])));
  ok('suspended user CANNOT send an inquiry', await denied(()=>c.query(
     "insert into inquiries (property_id,customer_id,agent_id,subject,message) values ($1,(select id from profiles where auth_user_id=$2),$3,'s','mmmmmmmmmm')",[pubProp.id,CUST,pubProp.agent_id])));
});
await c.query("update profiles set status='active' where auth_user_id=$1",[CUST]);

console.log(`\n=========== ${pass} passed, ${fail} failed ===========`);
await c.end();
process.exit(fail?1:0);
})();
