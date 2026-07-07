    const SUPABASE_URL='https://lsbpskmzffmaztczlokh.supabase.co';
    const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';
    const session=JSON.parse(localStorage.getItem('sat_user')||'{}');
    if(session.role!=='admin') window.location.href='admin-login.html';
    let users=[],tests=[],questions=[],submissions=[],scored=[];
    function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function parseJson(v){if(!v)return{};if(typeof v==='object')return v;try{const p=JSON.parse(v);return typeof p==='string'?JSON.parse(p):p}catch{return{}}}
    async function get(path){const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});if(!res.ok)throw new Error(await res.text());return res.json()}
    function scoreSubmission(s){
      const qs=questions.filter(q=>q.test_id===s.test_id);
      const answers=parseJson(s.answers);
      let correct=0;
      qs.forEach(q=>{if(answers[q.id]!==null&&answers[q.id]!==undefined&&Number(answers[q.id])===Number(q.correct))correct++});
      const pct=qs.length?correct/qs.length:0;
      return Math.round(400+pct*1200);
    }
    function fmtTime(sec){sec=Number(sec)||0;const m=Math.floor(sec/60),s=sec%60;return `${m}m ${String(s).padStart(2,'0')}s`}
    function bestRows(){
      const filter=document.getElementById('testFilter').value;
      const source=filter==='overall'?scored:scored.filter(s=>s.test_id===filter);
      const best=new Map();
      source.forEach(item=>{const prev=best.get(item.student_id);if(!prev||item.score>prev.score)best.set(item.student_id,item)});
      return [...best.values()].sort((a,b)=>b.score-a.score||b.correct-a.correct);
    }
    function render(){
      const body=document.getElementById('rows');
      const rows=bestRows();
      if(!rows.length){body.innerHTML='<tr><td colspan="7" class="empty">No submitted tests yet.</td></tr>';return}
      body.innerHTML=rows.map((r,i)=>{
        const u=users.find(x=>x.id===r.student_id)||{};
        const t=tests.find(x=>x.id===r.test_id)||{};
        const submitted=new Date(r.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
        return `<tr>
          <td><span class="rank">#${i+1}</span></td>
          <td><div class="student">${esc(u.full_name||'Student')}</div><div class="sub">@${esc(u.username||'unknown')}</div></td>
          <td>${esc(t.name||'Untitled test')}</td>
          <td><span class="score">${r.score}</span></td>
          <td>${r.correct}/${r.total}</td>
          <td>${fmtTime(r.time_taken)}</td>
          <td>${submitted}</td>
        </tr>`;
      }).join('');
    }
    async function load(){
      try{
        [users,tests,questions,submissions]=await Promise.all([
          get('users?role=eq.student&select=id,full_name,username'),
          get('tests?select=id,name,status'),
          get('questions?select=id,test_id,correct'),
          get('submissions?select=*&order=submitted_at.desc')
        ]);
        document.getElementById('testFilter').innerHTML='<option value="overall">Overall best score</option>'+tests.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
        scored=submissions.map(s=>{
          const qs=questions.filter(q=>q.test_id===s.test_id);
          const answers=parseJson(s.answers);
          let correct=0;qs.forEach(q=>{if(answers[q.id]!==null&&answers[q.id]!==undefined&&Number(answers[q.id])===Number(q.correct))correct++});
          return {...s,score:scoreSubmission(s),correct,total:qs.length};
        });
        render();
      }catch(err){
        document.getElementById('rows').innerHTML='<tr><td colspan="7" class="empty">Could not load leaderboard data.</td></tr>';
      }
    }
    load();
