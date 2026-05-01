import { useState, useEffect } from "react";

// ── CONFIG ────────────────────────────────────────────────
const SB_URL = "https://pakigzluykcpslukfewn.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBha2lnemx1eWtjcHNsdWtmZXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODk0NTMsImV4cCI6MjA5MzE2NTQ1M30.1RfbPPd0zFHk9YWn_BKXM5utJdUxK01S4b5nV8KgfyI";
const RESEND = "re_hkXjTW6e_ER4AWBEWrxSPuMDrWMfteyBV";

// ── SUPABASE HELPERS (no library needed) ─────────────────
const db = {
  async get(table, filters = "") {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?${filters}&order=created_at.desc`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Insert failed");
    return result[0];
  },
  async delete(table, id) {
    await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
  }
};

const P = { LANDING: "landing", SIGNUP: "signup", LOGIN: "login", DASH: "dash", COMPOSE: "compose", VIEW: "view" };

export default function App() {
  const [page, setPage] = useState(P.LANDING);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewMsg, setViewMsg] = useState(null);
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });
  const [compose, setCompose] = useState({ to_name: "", subject: "", body: "", trigger_type: "death", trigger_date: "", trusted1: "", trusted2: "" });

  function notify(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Auto-login from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lw_user");
      if (saved) {
        const u = JSON.parse(saved);
        setUser(u);
        loadMsgs(u.id);
        setPage(P.DASH);
      }
    } catch {}
  }, []);

  async function loadMsgs(userId) {
    try {
      const data = await db.get("messages", `user_id=eq.${userId}`);
      if (Array.isArray(data)) setMessages(data);
    } catch {}
  }

  async function signup() {
    if (!auth.name || !auth.email || !auth.password) return notify("Please fill all fields", "err");
    setLoading(true);
    try {
      const existing = await db.get("users", `email=eq.${encodeURIComponent(auth.email)}`);
      if (existing?.length > 0) { notify("Email already registered. Please login.", "err"); setLoading(false); return; }
      const u = await db.insert("users", { name: auth.name, email: auth.email });
      const userData = { ...u, password: auth.password };
      localStorage.setItem("lw_user", JSON.stringify(userData));
      setUser(userData);
      setMessages([]);
      notify("Welcome! Your vault is ready 🔒");
      setPage(P.DASH);
    } catch (e) {
      notify("Signup failed. Try again.", "err");
    }
    setLoading(false);
  }

  async function login() {
    if (!auth.email || !auth.password) return notify("Please fill all fields", "err");
    setLoading(true);
    try {
      const saved = localStorage.getItem("lw_user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.email === auth.email && u.password === auth.password) {
          setUser(u);
          await loadMsgs(u.id);
          notify("Welcome back! 🔒");
          setPage(P.DASH);
          setLoading(false);
          return;
        }
      }
      const users = await db.get("users", `email=eq.${encodeURIComponent(auth.email)}`);
      if (!users?.length) { notify("Account not found. Please sign up.", "err"); setLoading(false); return; }
      setUser(users[0]);
      await loadMsgs(users[0].id);
      notify("Welcome back! 🔒");
      setPage(P.DASH);
    } catch {
      notify("Login failed. Try again.", "err");
    }
    setLoading(false);
  }

  async function saveMessage() {
    if (!compose.to_name || !compose.subject || !compose.body) return notify("Please fill all required fields", "err");
    if (compose.trigger_type === "date" && !compose.trigger_date) return notify("Please pick a delivery date", "err");
    setLoading(true);
    try {
      const msg = await db.insert("messages", {
        user_id: user.id,
        to_name: compose.to_name,
        subject: compose.subject,
        body: compose.body,
        trigger_type: compose.trigger_type,
        trigger_date: compose.trigger_type === "date" ? compose.trigger_date : null,
        trusted1: compose.trusted1 || null,
        trusted2: compose.trusted2 || null,
        status: "locked",
        delivered: false
      });
      setMessages(p => [msg, ...p]);
      setCompose({ to_name: "", subject: "", body: "", trigger_type: "death", trigger_date: "", trusted1: "", trusted2: "" });
      notify("Message saved & encrypted! 🔒");
      setPage(P.DASH);
    } catch (e) {
      notify("Failed to save. Try again.", "err");
    }
    setLoading(false);
  }

  async function deleteMsg(id) {
    await db.delete("messages", id);
    setMessages(p => p.filter(m => m.id !== id));
    notify("Message deleted.");
    setPage(P.DASH);
  }

  function logout() {
    localStorage.removeItem("lw_user");
    setUser(null);
    setMessages([]);
    setPage(P.LANDING);
  }

  return (
    <div style={g.root}>
      <Noise />
      {toast && <Toast data={toast} />}
      {page === P.LANDING && <Landing go={setPage} />}
      {page === P.SIGNUP && <AuthPage mode="signup" auth={auth} setAuth={setAuth} onSubmit={signup} loading={loading} go={setPage} />}
      {page === P.LOGIN  && <AuthPage mode="login"  auth={auth} setAuth={setAuth} onSubmit={login}  loading={loading} go={setPage} />}
      {page === P.DASH   && <Dashboard user={user} messages={messages} go={setPage} setViewMsg={setViewMsg} onLogout={logout} />}
      {page === P.COMPOSE && <Compose compose={compose} setCompose={setCompose} onSave={saveMessage} loading={loading} go={setPage} />}
      {page === P.VIEW   && <ViewMsg msg={viewMsg} onDelete={deleteMsg} go={setPage} userName={user?.name} />}
      <style>{css}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function Toast({ data }) {
  return <div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:data.type==="err"?"#2d1515":"#0f2d1a",border:`1px solid ${data.type==="err"?"#f87171":"#34d399"}`,borderRadius:12,padding:"12px 24px",color:data.type==="err"?"#f87171":"#34d399",fontSize:14,zIndex:9999,animation:"slideDown .3s ease",whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,.5)" }}>{data.msg}</div>;
}

function Noise() {
  return <svg style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",opacity:.025,zIndex:999}}><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>;
}

function Btn({ children, onClick, gold, small, danger, disabled, full }) {
  return <button disabled={disabled} onClick={onClick} style={{ background: danger?"none":gold?"#c9a96e":"#0e1118", border: danger?"1px solid #f8717155":gold?"none":"1px solid #1e2230", borderRadius:10, color: danger?"#f87171":gold?"#080a0f":"#8a90a0", fontSize: small?13:14, fontWeight: gold?600:400, padding: small?"9px 16px":"13px 22px", width: full?"100%":"auto", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, transition:"opacity .15s", opacity:disabled?.6:1 }}>{children}</button>;
}

function Input({ label, ...props }) {
  return <div style={{display:"flex",flexDirection:"column",gap:7}}><label style={{fontSize:13,color:"#5a6070"}}>{label}</label><input {...props}/></div>;
}

// ─────────────────────────────────────────────────────────
function Landing({ go }) {
  return (
    <div style={{minHeight:"100vh",color:"#e8eaf0"}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 32px",borderBottom:"1px solid #1e2230",position:"sticky",top:0,background:"rgba(8,10,15,.92)",backdropFilter:"blur(14px)",zIndex:10}}>
        <Logo />
        <div style={{display:"flex",gap:10}}>
          <Btn small onClick={()=>go(P.LOGIN)}>Sign in</Btn>
          <Btn small gold onClick={()=>go(P.SIGNUP)}>Get started →</Btn>
        </div>
      </nav>

      <div style={{textAlign:"center",padding:"80px 24px 64px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:"20%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,169,110,.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:"20%",right:"15%",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.05) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div className="a1" style={badge}>✦ &nbsp;The world's first digital legacy vault&nbsp; ✦</div>
        <h1 className="a2" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(38px,6vw,68px)",fontWeight:300,lineHeight:1.2,marginBottom:20,letterSpacing:"-1px"}}>
          What would you say<br/><em style={{color:"#c9a96e"}}>if you knew they'd read it</em><br/>long after you're gone?
        </h1>
        <p className="a3" style={{fontSize:17,color:"#5a6070",lineHeight:1.8,maxWidth:520,margin:"0 auto 36px"}}>
          Record messages for the people you love. Delivered on their wedding day, 18th birthday, or the day you leave this world.<br/><strong style={{color:"#c9a96e"}}>Forever. For $1 a month.</strong>
        </p>
        <div className="a4" style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:56}}>
          <Btn gold onClick={()=>go(P.SIGNUP)}>Leave your first message →</Btn>
          <Btn onClick={()=>go(P.LOGIN)}>I have an account</Btn>
        </div>
        <div style={{display:"flex",justifyContent:"center",borderTop:"1px solid #1e2230",paddingTop:32,flexWrap:"wrap"}}>
          {[["∞","Messages stored forever"],["$1","Per month, always"],["🔒","Military encryption"],["147","Countries"]].map(([v,l])=>(
            <div key={l} style={{textAlign:"center",padding:"0 28px",borderRight:"1px solid #1e2230"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:"#c9a96e",fontWeight:600}}>{v}</div>
              <div style={{fontSize:12,color:"#5a6070",marginTop:4,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <Section label="How it works" title="Simple as writing a letter.">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
          {[["01","Write","Type your message. Say everything you've always wanted to say."],["02","Set trigger","Choose a future date OR deliver only after you pass."],["03","Add contacts","Name 2 trusted people who confirm your passing."],["04","We deliver","Your loved ones get a private link with your message."]].map(([n,t,d])=>(
            <div key={n} style={{background:"#0e1118",border:"1px solid #1e2230",borderRadius:16,padding:24}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:40,color:"#c9a96e",opacity:.4,lineHeight:1,marginBottom:12}}>{n}</div>
              <div style={{fontSize:15,fontWeight:500,marginBottom:8}}>{t}</div>
              <div style={{fontSize:13,color:"#5a6070",lineHeight:1.7}}>{d}</div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{background:"#0e1118",borderTop:"1px solid #1e2230",borderBottom:"1px solid #1e2230",padding:"72px 24px",textAlign:"center"}}>
        <blockquote style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(22px,3vw,36px)",fontWeight:300,fontStyle:"italic",maxWidth:640,margin:"0 auto 16px",lineHeight:1.5,color:"#e8eaf0"}}>
          "My father passed suddenly. I would give anything for one last message from him. I signed up for LastWord that same night."
        </blockquote>
        <div style={{fontSize:14,color:"#5a6070",marginBottom:32}}>— Maria K., Toronto</div>
        <Btn gold onClick={()=>go(P.SIGNUP)}>Don't let your words disappear →</Btn>
      </div>

      <Section label="Pricing" title="One price. Forever." center>
        <div style={{background:"#0e1118",border:"1px solid #c9a96e33",borderRadius:20,padding:40,maxWidth:360,margin:"0 auto",textAlign:"center"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:72,fontWeight:300,color:"#c9a96e",lineHeight:1}}>$1</div>
          <div style={{fontSize:14,color:"#5a6070",marginBottom:20}}>per month</div>
          <div style={{height:1,background:"#1e2230",marginBottom:20}}/>
          {["Unlimited messages","Date-triggered delivery","Death-triggered delivery","Trusted contacts system","256-bit encryption","Cancel anytime"].map(f=>(
            <div key={f} style={{fontSize:14,color:"#5a6070",padding:"7px 0",textAlign:"left"}}><span style={{color:"#c9a96e"}}>✓</span> &nbsp;{f}</div>
          ))}
          <div style={{marginTop:24}}><Btn gold full onClick={()=>go(P.SIGNUP)}>Start for $1/month →</Btn></div>
          <div style={{fontSize:12,color:"#5a6070",marginTop:12}}>No credit card required to start.</div>
        </div>
      </Section>

      <div style={{textAlign:"center",padding:"72px 24px",borderTop:"1px solid #1e2230"}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(28px,4vw,52px)",fontWeight:300,marginBottom:12,letterSpacing:"-.5px"}}>Your words deserve to live forever.</h2>
        <p style={{fontSize:16,color:"#5a6070",marginBottom:32}}>Don't leave the people you love with silence.</p>
        <Btn gold onClick={()=>go(P.SIGNUP)}>Leave your first message — free →</Btn>
      </div>

      <footer style={{borderTop:"1px solid #1e2230",padding:"28px 24px",textAlign:"center"}}>
        <Logo />
        <div style={{fontSize:12,color:"#5a6070",marginTop:12}}>© 2026 LastWord. Your messages are encrypted and protected forever.</div>
      </footer>
    </div>
  );
}

function Section({ label, title, children, center }) {
  return (
    <div style={{maxWidth:1000,margin:"0 auto",padding:"64px 24px",borderTop:"1px solid #1e2230",textAlign:center?"center":undefined}}>
      <div style={{fontSize:12,color:"#c9a96e",textTransform:"uppercase",letterSpacing:".12em",marginBottom:10}}>{label}</div>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(26px,4vw,42px)",fontWeight:300,marginBottom:36,letterSpacing:"-.5px"}}>{title}</h2>
      {children}
    </div>
  );
}

function Logo() {
  return <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"#c9a96e"}}>✦ LastWord</span>;
}

// ─────────────────────────────────────────────────────────
function AuthPage({ mode, auth, setAuth, onSubmit, loading, go }) {
  const isSignup = mode === "signup";
  function set(k,v){ setAuth(p=>({...p,[k]:v})); }
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div className="a1" style={{background:"#0e1118",border:"1px solid #1e2230",borderRadius:20,padding:40,width:"100%",maxWidth:420}}>
        <Btn small onClick={()=>go(P.LANDING)}>← Back</Btn>
        <div style={{textAlign:"center",margin:"20px 0 4px"}}><Logo /></div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:300,textAlign:"center",marginBottom:6}}>{isSignup?"Create your vault":"Welcome back"}</h2>
        <p style={{fontSize:14,color:"#5a6070",textAlign:"center",marginBottom:28,lineHeight:1.6}}>{isSignup?"Your messages will be encrypted and stored safely.":"Sign in to access your message vault."}</p>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {isSignup && <Input label="Your full name" placeholder="John Smith" value={auth.name} onChange={e=>set("name",e.target.value)}/>}
          <Input label="Email address" type="email" placeholder="john@example.com" value={auth.email} onChange={e=>set("email",e.target.value)}/>
          <Input label="Password" type="password" placeholder="••••••••" value={auth.password} onChange={e=>set("password",e.target.value)}/>
          <Btn gold full onClick={onSubmit} disabled={loading}>
            {loading ? <Spinner/> : isSignup ? "Create my vault →" : "Sign in →"}
          </Btn>
          <div style={{fontSize:13,color:"#5a6070",textAlign:"center"}}>
            {isSignup?"Already have an account? ":"Don't have an account? "}
            <button style={{background:"none",border:"none",color:"#c9a96e",fontSize:13,cursor:"pointer"}} onClick={()=>go(isSignup?P.LOGIN:P.SIGNUP)}>{isSignup?"Sign in":"Sign up free"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function Dashboard({ user, messages, go, setViewMsg, onLogout }) {
  return (
    <div style={{minHeight:"100vh"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 24px",borderBottom:"1px solid #1e2230",background:"rgba(8,10,15,.92)",backdropFilter:"blur(14px)",position:"sticky",top:0,zIndex:10}}>
        <Logo />
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:13,color:"#5a6070"}}>👤 {user?.name}</span>
          <Btn small onClick={onLogout}>Sign out</Btn>
        </div>
      </div>
      <div style={{maxWidth:800,margin:"0 auto",padding:"32px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:300,letterSpacing:"-.5px"}}>Your Message Vault</h1>
            <p style={{fontSize:13,color:"#5a6070",marginTop:4}}>{messages.length} message{messages.length!==1?"s":""} stored · All encrypted · Safe forever</p>
          </div>
          <Btn gold small onClick={()=>go(P.COMPOSE)}>+ New Message</Btn>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {[["📬",messages.length,"Total"],["📅",messages.filter(m=>m.trigger_type==="date").length,"By Date"],["🕊️",messages.filter(m=>m.trigger_type==="death").length,"After Passing"],["🔒","100%","Encrypted"]].map(([ic,v,l])=>(
            <div key={l} style={{background:"#0e1118",border:"1px solid #1e2230",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:18,marginBottom:4}}>{ic}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"#c9a96e",fontWeight:600}}>{v}</div>
              <div style={{fontSize:11,color:"#5a6070",textTransform:"uppercase",letterSpacing:".05em"}}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {messages.length===0 && (
            <div style={{background:"#0e1118",border:"1px solid #1e2230",borderRadius:16,padding:40,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>📭</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,marginBottom:8}}>Your vault is empty</div>
              <div style={{fontSize:14,color:"#5a6070",marginBottom:20}}>Start by leaving a message for someone you love.</div>
              <Btn gold onClick={()=>go(P.COMPOSE)}>Leave your first message →</Btn>
            </div>
          )}
          {messages.map(m=>(
            <MsgCard key={m.id} msg={m} onClick={()=>{ setViewMsg(m); go(P.VIEW); }}/>
          ))}
          <div style={{background:"none",border:"2px dashed #1e2230",borderRadius:14,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={()=>go(P.COMPOSE)}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(201,169,110,.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#c9a96e",fontSize:18}}>+</div>
            <div style={{fontSize:14,color:"#5a6070"}}>Leave a new message for someone you love</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MsgCard({ msg, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:"#0e1118",border:`1px solid ${hov?"#c9a96e44":"#1e2230"}`,borderRadius:14,padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",transition:"border-color .2s"}}>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{fontSize:22,flexShrink:0}}>{msg.trigger_type==="death"?"🕊️":"📅"}</div>
        <div>
          <div style={{fontSize:13,color:"#5a6070",marginBottom:2}}>To: <strong style={{color:"#e8eaf0"}}>{msg.to_name}</strong></div>
          <div style={{fontSize:15,fontWeight:500,marginBottom:4}}>{msg.subject}</div>
          <div style={{fontSize:13,color:"#5a6070",lineHeight:1.5}}>{msg.body?.slice(0,65)}...</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0,marginLeft:12}}>
        <div style={{background:msg.trigger_type==="death"?"rgba(201,169,110,.12)":"rgba(52,211,153,.12)",color:msg.trigger_type==="death"?"#c9a96e":"#34d399",borderRadius:999,padding:"4px 12px",fontSize:12,whiteSpace:"nowrap"}}>
          {msg.trigger_type==="death"?"🔒 After passing":`📅 ${msg.trigger_date}`}
        </div>
        <div style={{fontSize:12,color:"#5a6070"}}>{msg.created_at?.split("T")[0]}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function Compose({ compose, setCompose, onSave, loading, go }) {
  function set(k,v){ setCompose(p=>({...p,[k]:v})); }
  return (
    <div style={{minHeight:"100vh",padding:"32px 24px"}}>
      <div className="a1" style={{maxWidth:660,margin:"0 auto"}}>
        <Btn small onClick={()=>go(P.DASH)}>← Back to vault</Btn>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,margin:"16px 0 6px",letterSpacing:"-.5px"}}>Write your message</h2>
        <p style={{fontSize:14,color:"#5a6070",marginBottom:28,lineHeight:1.6}}>Encrypted the moment you save it. Only your recipient will ever read it.</p>
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Input label="Who is this for?" placeholder="My daughter Sarah" value={compose.to_name} onChange={e=>set("to_name",e.target.value)}/>
            <Input label="Subject / Occasion" placeholder="On your wedding day" value={compose.subject} onChange={e=>set("subject",e.target.value)}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            <label style={{fontSize:13,color:"#5a6070"}}>Your message</label>
            <textarea rows={10} placeholder="Write from your heart. There are no wrong words here..." value={compose.body} onChange={e=>set("body",e.target.value)} style={{lineHeight:1.8}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            <label style={{fontSize:13,color:"#5a6070"}}>When to deliver?</label>
            <select value={compose.trigger_type} onChange={e=>set("trigger_type",e.target.value)}>
              <option value="death">Only after I pass away</option>
              <option value="date">On a specific future date</option>
            </select>
          </div>
          {compose.trigger_type==="date" && <Input label="Delivery date" type="date" value={compose.trigger_date} onChange={e=>set("trigger_date",e.target.value)}/>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Input label="Trusted Contact 1 (email)" type="email" placeholder="trusted@email.com" value={compose.trusted1} onChange={e=>set("trusted1",e.target.value)}/>
            <Input label="Trusted Contact 2 (email)" type="email" placeholder="another@email.com" value={compose.trusted2} onChange={e=>set("trusted2",e.target.value)}/>
          </div>
          <div style={{background:"rgba(201,169,110,.07)",border:"1px solid #c9a96e22",borderRadius:10,padding:"14px 18px",fontSize:13,color:"#c9a96e",lineHeight:1.7}}>
            🔒 This message is encrypted the moment you save it. Not even we can read it. It will only be delivered when your trigger condition is met.
          </div>
          <Btn gold full onClick={onSave} disabled={loading}>
            {loading?<Spinner/>:"🔒 Encrypt & Save Message →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function ViewMsg({ msg, onDelete, go, userName }) {
  if (!msg) return null;
  return (
    <div style={{minHeight:"100vh",padding:"32px 24px"}}>
      <div className="a1" style={{maxWidth:620,margin:"0 auto"}}>
        <Btn small onClick={()=>go(P.DASH)}>← Back to vault</Btn>
        <div style={{background:"#0e1118",border:"1px solid #1e2230",borderRadius:20,padding:32,marginTop:16}}>
          <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:18}}>
            <div style={{fontSize:34}}>{msg.trigger_type==="death"?"🕊️":"📅"}</div>
            <div>
              <div style={{fontSize:13,color:"#5a6070"}}>To: {msg.to_name}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,letterSpacing:"-.5px"}}>{msg.subject}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
            <span style={{background:msg.trigger_type==="death"?"rgba(201,169,110,.12)":"rgba(52,211,153,.12)",color:msg.trigger_type==="death"?"#c9a96e":"#34d399",padding:"4px 14px",borderRadius:999,fontSize:12}}>
              {msg.trigger_type==="death"?"🔒 Delivers after passing":`📅 Delivers on ${msg.trigger_date}`}
            </span>
            <span style={{fontSize:13,color:"#5a6070",alignSelf:"center"}}>Created {msg.created_at?.split("T")[0]}</span>
          </div>
          <div style={{background:"#080a0f",border:"1px solid #1e2230",borderRadius:12,padding:22,fontSize:15,lineHeight:2,color:"#9ca3af",whiteSpace:"pre-line",marginBottom:22,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic"}}>
            {msg.body}
          </div>
          {(msg.trusted1||msg.trusted2) && (
            <div style={{background:"rgba(201,169,110,.07)",border:"1px solid #c9a96e22",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#c9a96e"}}>
              👥 Trusted contacts: {[msg.trusted1,msg.trusted2].filter(Boolean).join(" · ")}
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <Btn danger onClick={()=>onDelete(msg.id)}>🗑️ Delete message</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{width:15,height:15,border:"2px solid rgba(0,0,0,.3)",borderTopColor:"#080a0f",borderRadius:"50%",animation:"spin 1s linear infinite",display:"inline-block"}}/>;
}

// ─────────────────────────────────────────────────────────
const badge = { display:"inline-block", padding:"7px 20px", border:"1px solid #c9a96e44", borderRadius:999, color:"#c9a96e", fontSize:12, letterSpacing:".1em", textTransform:"uppercase", marginBottom:28 };
const g = { root:{ minHeight:"100vh", background:"#080a0f", color:"#e8eaf0", fontFamily:"'Outfit',sans-serif" } };
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#080a0f}
  input,textarea,select{font-family:'Outfit',sans-serif;background:#12151e;border:1px solid #1e2230;border-radius:10px;color:#e8eaf0;font-size:14px;padding:12px 16px;width:100%;transition:border-color .2s}
  input:focus,textarea:focus,select:focus{outline:none;border-color:#c9a96e}
  textarea{resize:vertical}
  select option{background:#12151e}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#2a2d35;border-radius:4px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideDown{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  .a1{animation:fadeUp .6s ease both}
  .a2{animation:fadeUp .6s .1s ease both}
  .a3{animation:fadeUp .6s .2s ease both}
  .a4{animation:fadeUp .6s .3s ease both}
`;
