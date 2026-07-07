    const SUPABASE_URL='https://lsbpskmzffmaztczlokh.supabase.co';
    const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';
    const session=JSON.parse(localStorage.getItem('sat_user')||'{}');
    if(!session.id) window.location.href='student-login.html';
    document.getElementById('studentName').textContent=session.name||'Student';
    let users=[],tests=[],questions=[],submissions=[],scored=[];
    function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function parseJson(v){if(!v)return{};if(typeof v==='object')return v;try{const p=JSON.parse(v);return typeof p==='string'?JSON.parse(p):p}catch{return{}}}
    async function get(path){const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});if(!res.ok)throw new Error(await res.text());return res.json()}
    function score(sub){
      const qs=questions.filter(q=>q.test_id===sub.test_id);
      const answers=parseJson(sub.answers);
      let correct=0;
      qs.forEach(q=>{if(answers[q.id]!==null&&answers[q.id]!==undefined&&Number(answers[q.id])===Number(q.correct))correct++});
      return {score:qs.length?Math.round(400+(correct/qs.length)*1200):0,correct,total:qs.length};
    }
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
      if(!rows.length){body.innerHTML='<tr><td colspan="6" class="empty">No submitted tests yet.</td></tr>';return}
      body.innerHTML=rows.map((r,i)=>{
        const user=users.find(u=>u.id===r.student_id)||{};
        const test=tests.find(t=>t.id===r.test_id)||{};
        const submitted=new Date(r.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
        const isMe=r.student_id===session.id;
        return `<tr class="${isMe?'me':''}">
          <td><span class="rank">#${i+1}</span></td>
          <td><div class="name">${esc(user.full_name||'Student')}${isMe?'<span class="tag">You</span>':''}</div><div class="sub">@${esc(user.username||'student')}</div></td>
          <td>${esc(test.name||'Untitled test')}</td>
          <td><span class="score">${r.score}</span></td>
          <td>${r.correct}/${r.total}</td>
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
        scored=submissions.map(s=>({...s,...score(s)}));
        render();
      }catch(err){
        document.getElementById('rows').innerHTML='<tr><td colspan="6" class="empty">Could not load leaderboard data.</td></tr>';
      }
    }
    load();
