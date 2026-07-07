    const SUPABASE_URL='https://lsbpskmzffmaztczlokh.supabase.co';
    const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzYnBza216ZmZtYXp0Y3psb2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTc5NzMsImV4cCI6MjA5ODI3Mzk3M30.zRtly7a6XPKoU6BaZ2eftQxxOTFSUkw1wQ8A6-H1-tI';
    const session=JSON.parse(localStorage.getItem('sat_user')||'{}');
    if(session.role!=='admin') window.location.href='admin-login.html';

    function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
    async function get(path){
      const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});
      if(!res.ok) throw new Error(await res.text());
      return res.json();
    }
    function createTest(){
      localStorage.setItem('sat_draft_test',JSON.stringify({name:'',moduleQuestions:{rw1:[],rw2:[],math1:[],math2:[]}}));
      window.location.href='admin-test-builder.html';
    }
    async function load(){
      try{
        const [tests,questions]=await Promise.all([
          get('tests?select=*&order=created_at.desc'),
          get('questions?select=test_id,section')
        ]);
        document.getElementById('totalTests').textContent=tests.length;
        document.getElementById('publishedTests').textContent=tests.filter(t=>t.status==='published').length;
        document.getElementById('totalQuestions').textContent=questions.length;
        const rows=document.getElementById('testRows');
        if(!tests.length){rows.innerHTML='<tr><td colspan="5" class="empty">No tests yet.</td></tr>';return}
        rows.innerHTML=tests.map(t=>{
          const count=questions.filter(q=>q.test_id===t.id).length;
          const date=new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
          return `<tr>
            <td><div class="name">${esc(t.name)}</div><div class="sub">${esc(t.id)}</div></td>
            <td><span class="badge ${esc(t.status)}">${esc(t.status)}</span></td>
            <td>${count}</td>
            <td>${date}</td>
            <td><a class="btn btn-soft" href="admin-test-builder.html">Open builder</a></td>
          </tr>`;
        }).join('');
      }catch(err){
        document.getElementById('testRows').innerHTML='<tr><td colspan="5" class="empty">Could not load tests from Supabase.</td></tr>';
      }
    }
    load();
