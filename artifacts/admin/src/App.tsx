import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, MessageSquare, Bot, Star, BarChart3,
  Flag, Bell, Smartphone, Shield, FileText, Server, Settings,
  Search, Menu, X, Activity, Zap, DollarSign, UserPlus,
  AlertTriangle, CheckCircle2
} from "lucide-react";
import "./App.css";
import { supabase } from "./lib/supabase";
import AdminLogin from "./components/AdminLogin";

const menu = [
  ["Dashboard", LayoutDashboard],
  ["Kullanıcılar", Users],
  ["Sohbetler", MessageSquare],
  ["AI Merkezi", Bot],
  ["Premium", Star],
  ["Analitik", BarChart3],
  ["Feature Flags", Flag],
  ["Bildirimler", Bell],
  ["Mobil Kontrol", Smartphone],
  ["Güvenlik", Shield],
  ["Audit Log", FileText],
  ["Sistem", Server],
  ["Ayarlar", Settings],
] as const;

function App() {
  const [session, setSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAdminSession() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        if (mounted) {
          setSession(false);
          setCheckingSession(false);
        }
        return;
      }

      const { data: admin } = await supabase
        .from("admin_users")
        .select("user_id, role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (mounted) {
        setSession(!!admin?.is_active);
        setCheckingSession(false);
      }
    }

    checkAdminSession();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAdminSession();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const [active, setActive] = useState("Dashboard");
  const [open, setOpen] = useState(false);

  if (checkingSession) {
    return <div className="loginPage"><div className="loginCard"><h1>AkılCEP</h1><p>Yönetim Merkezi yükleniyor...</p></div></div>;
  }

  if (!session) {
    return <AdminLogin onLogin={() => setSession(true)} />;
  }

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brandMark">A</div>
          <div>
            <strong>AkılCEP</strong>
            <span>Yönetim Merkezi</span>
          </div>
          <button className="closeBtn" onClick={() => setOpen(false)}><X /></button>
        </div>

        <nav>
          {menu.map(([name, Icon]) => (
            <button
              key={name}
              className={active === name ? "navItem active" : "navItem"}
              onClick={() => { setActive(name); setOpen(false); }}
            >
              <Icon size={19} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="systemBox">
          <div className="statusDot" />
          <div>
            <b>Sistemler aktif</b>
            <span>Tüm servisler çalışıyor</span>
          </div>
        </div>
      </aside>

      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="menuBtn" onClick={() => setOpen(true)}><Menu /></button>
          <div>
            <p>AkılCEP Yönetim Merkezi</p>
            <h1>{active}</h1>
          </div>

          <div className="topActions">
            <div className="search">
              <Search size={17} />
              <input placeholder="Ara..." />
            </div>
            <button className="iconBtn"><Bell size={19} /></button>
            <div className="adminAvatar">SA</div>
          </div>
        </header>

        <section className="content">
          <div className="welcome">
            <div>
              <span className="eyebrow">GENEL BAKIŞ</span>
              <h2>AkılCEP'e hoş geldin 👋</h2>
              <p>Uygulamanın tüm sistemlerini tek merkezden yönet.</p>
            </div>
            <div className="live"><span /> LIVE</div>
          </div>

          <div className="stats">
            <Stat icon={Users} label="Toplam Kullanıcı" value="12,842" change="+8.4%" />
            <Stat icon={Activity} label="Aktif Kullanıcı" value="3,284" change="+12.1%" />
            <Stat icon={Star} label="Premium" value="1,247" change="+6.8%" />
            <Stat icon={DollarSign} label="Aylık Gelir" value="₺184,620" change="+14.3%" />
          </div>

          <div className="grid">
            <div className="panel large">
              <div className="panelHead">
                <div>
                  <span className="panelLabel">AKTİVİTE</span>
                  <h3>Kullanıcı Aktivitesi</h3>
                </div>
                <select><option>Son 30 gün</option><option>Son 7 gün</option></select>
              </div>
              <div className="chart">
                {[38,52,44,68,57,73,64,81,69,88,76,94,82,91].map((h,i) =>
                  <div className="barWrap" key={i}><div className="bar" style={{height:`${h}%`}} /></div>
                )}
              </div>
              <div className="chartFooter">
                <span><i className="blueDot" /> Aktif kullanıcılar</span>
                <b>+12.1%</b>
              </div>
            </div>

            <div className="panel">
              <div className="panelHead">
                <div>
                  <span className="panelLabel">SİSTEM</span>
                  <h3>Servis Durumu</h3>
                </div>
              </div>
              <Service name="API Server" />
              <Service name="Database" />
              <Service name="AI Services" />
              <Service name="Notifications" />
              <Service name="Storage" />
            </div>
          </div>

          <div className="grid three">
            <div className="panel">
              <span className="panelLabel">AI KULLANIMI</span>
              <h3>Bugünkü AI İstekleri</h3>
              <div className="bigNumber">48,291</div>
              <div className="progress"><span style={{width:"72%"}} /></div>
              <small>Günlük limitin %72'si kullanıldı</small>
            </div>

            <div className="panel">
              <span className="panelLabel">YENİ KAYIT</span>
              <h3>Bugünkü Kayıtlar</h3>
              <div className="bigNumber">284</div>
              <div className="miniStats"><UserPlus size={17} /> Dün: 241 <b>+17.8%</b></div>
            </div>

            <div className="panel">
              <span className="panelLabel">GÜVENLİK</span>
              <h3>Güvenlik Durumu</h3>
              <div className="security"><CheckCircle2 size={23} /><b>Normal</b></div>
              <small>Son olay: 2 saat önce</small>
            </div>
          </div>

          <div className="panel quick">
            <div>
              <span className="panelLabel">HIZLI KONTROL</span>
              <h3>AkılCEP Kontrolleri</h3>
            </div>
            <div className="quickBtns">
              <Quick icon={Zap} text="Feature Flags" />
              <Quick icon={Bot} text="AI Merkezi" />
              <Quick icon={Smartphone} text="Mobil Kontrol" />
              <Quick icon={AlertTriangle} text="Sistem Logları" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({icon:Icon,label,value,change}:any) {
  return <div className="stat"><div className="statIcon"><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong><small>{change} <em>bu ay</em></small></div></div>;
}

function Service({name}:any) {
  return <div className="service"><span>{name}</span><div><i/> Operational</div></div>;
}

function Quick({icon:Icon,text}:any) {
  return <button><Icon size={18}/><span>{text}</span></button>;
}

export default App;
