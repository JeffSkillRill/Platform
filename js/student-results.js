    const SUPABASE_URL='https://lsbpskmzffmaztczlokh.supabase.co';
    const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';
    const session=JSON.parse(localStorage.getItem('sat_user')||'{}');
    if(!session.id) window.location.href='student-login.html';
    document.getElementById('studentName').textContent=session.name||'Student';
    let tests=[],questions=[],submissions=[],rows=[];
    function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function parseJson(v){if(!v)return{};if(typeof v==='object')return v;try{const p=JSON.parse(v);return typeof p==='string'?JSON.parse(p):p}catch{return{}}}
    async function get(path){const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});if(!res.ok)throw new Error(await res.text());return res.json()}
    function scoreFor(sub){
      const qs=questions.filter(q=>q.test_id===sub.test_id);
      const answers=parseJson(sub.answers);
      let correct=0;
      qs.forEach(q=>{if(answers[q.id]!==null&&answers[q.id]!==undefined&&Number(answers[q.id])===Number(q.correct))correct++});
      const score=qs.length?Math.round(400+(correct/qs.length)*1200):0;
      return {score,correct,total:qs.length};
    }
    function fmtTime(sec){sec=Number(sec)||0;const m=Math.floor(sec/60),s=sec%60;return `${m}m ${String(s).padStart(2,'0')}s`}
    function openReview(id){
      const sub=submissions.find(s=>s.id===id);
      if(!sub)return;
      const test=tests.find(t=>t.id===sub.test_id)||{};
      const qs=questions.filter(q=>q.test_id===sub.test_id).sort((a,b)=>(a.order_num||0)-(b.order_num||0)).map(q=>({
        ...q,
        choices: typeof q.choices==='string'?JSON.parse(q.choices):q.choices
      }));
      localStorage.setItem('sat_last_result',JSON.stringify({
        submissionId:sub.id,
        testId:sub.test_id,
        testName:test.name||'Test Results',
        questions:qs,
        answers:parseJson(sub.answers),
        timeTaken:sub.time_taken||0
      }));
      window.location.href='student-test-results.html';
    }
    function render(){
      const body=document.getElementById('rows');
      if(!rows.length){body.innerHTML='<tr><td colspan="6" class="empty">No submitted tests yet.</td></tr>';return}
      body.innerHTML=rows.map(r=>{
        const test=tests.find(t=>t.id===r.test_id)||{};
        const meta=scoreFor(r);
        const submitted=new Date(r.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
        return `<tr>
          <td><div class="test">${esc(test.name||'Untitled test')}</div><div class="sub">${esc(r.id)}</div></td>
          <td><span class="score">${meta.score}</span></td>
          <td>${meta.correct}/${meta.total}</td>
          <td>${fmtTime(r.time_taken)}</td>
          <td>${submitted}</td>
          <td><button class="btn" onclick="openReview('${esc(r.id)}')">Review</button></td>
        </tr>`;
      }).join('');
    }
    async function load(){
      try{
        [tests,questions,submissions]=await Promise.all([
          get('tests?select=id,name'),
          get('questions?select=*'),
          get(`submissions?student_id=eq.${encodeURIComponent(session.id)}&select=*&order=submitted_at.desc`)
        ]);
        rows=submissions;
        render();
      }catch(err){
        document.getElementById('rows').innerHTML='<tr><td colspan="6" class="empty">Could not load results from Supabase.</td></tr>';
      }
    }
    load();
