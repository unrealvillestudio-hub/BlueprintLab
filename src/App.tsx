import { useState, useEffect } from "react";
import { loadAllBlueprints, upsertBlueprint, deleteBlueprint } from "./services/blueprintLabLoader";

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  bg: "#050608", panel: "#0b0c10", panel2: "#111318",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(124,58,237,0.4)",
  accent: "#7C3AED", accentBright: "#A78BFA", accentDim: "rgba(124,58,237,0.15)",
  text: "#E8E8F0", textMuted: "rgba(232,232,240,0.45)", textDim: "rgba(232,232,240,0.22)",
  green: "#10B981", amber: "#F59E0B", red: "#EF4444", blue: "#3B82F6",
  yellow: "#FFAB00", voice: "#06B6D4", copy: "#F43F5E",
};
const SCHEMA = {
  PERSON: "BP_PERSON_1.0",
  LOCATION: "BP_LOCATION_1.0",
  PRODUCT: "BP_PRODUCT_1.0",
  COPY: "BP_COPY_1.0",
};
const BRANDS = [
  { id: "D7Herbal",                  label: "D7Herbal",                        industry: "cosmetics_haircare",   color: "#10B981" },
  { id: "VivoseMask",                label: "Vivosé Mask",                      industry: "beauty_skincare",       color: "#EC4899" },
  { id: "DiamondDetails",            label: "Diamond Details",                  industry: "automotive_detailing",  color: "#3B82F6" },
  { id: "VizosCosmetics",            label: "Vizos Cosmetics",                  industry: "high-end_beauty",       color: "#8B5CF6" },
  { id: "PatriciaOsorioPersonal",    label: "Patricia Osorio · Personal",       industry: "personal_branding",     color: "#F59E0B" },
  { id: "PatriciaOsorioComunidad",   label: "Patricia Osorio · Comunidad",      industry: "community_networking",  color: "#F97316" },
  { id: "PatriciaOsorioVizosSalon",  label: "Patricia Osorio · Vizos Salón",   industry: "luxury_salon",          color: "#FFAB00" },
  { id: "NeuroneSCF",                label: "Neurone SCF",                      industry: "cosmetics_haircare",    color: "#0076A8" },
];
const LAB_COMPAT = {
  [SCHEMA.PERSON]:   ["ImageLab", "VideoLab", "VoiceLab"],
  [SCHEMA.LOCATION]: ["ImageLab", "VideoLab"],
  [SCHEMA.PRODUCT]:  ["ImageLab"],
  [SCHEMA.COPY]:     ["CopyLab"],
};
const LAB_COLORS = {
  ImageLab: "#FFAB00", VideoLab: "#3B82F6",
  VoiceLab: "#06B6D4", CopyLab: "#F43F5E",
};
const ALL_CHANNELS = [
  "META_ADS","TIKTOK_ADS","GOOGLE_SEARCH","GOOGLE_PMAX",
  "INSTAGRAM_ORGANICO","TIKTOK_ORGANICO","YOUTUBE","WEB","LANDING_PAGE","BLOG","EMAIL"
];

// INITIAL_BLUEPRINTS is kept as fallback only — Supabase is the source of truth
const INITIAL_BLUEPRINTS: any[] = [];

// ─── UTILS ───────────────────────────────────────────────────────────────────
function safeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
}
function getBrand(id: string) { return BRANDS.find(b => b.id === id); }
function getSchemaLabel(sv: string) {
  if (sv === SCHEMA.PERSON)   return "PERSON";
  if (sv === SCHEMA.LOCATION) return "LOCATION";
  if (sv === SCHEMA.PRODUCT)  return "PRODUCT";
  if (sv === SCHEMA.COPY)     return "COPY";
  return "UNKNOWN";
}
function getSchemaColor(sv: string) {
  if (sv === SCHEMA.PERSON)   return C.accentBright;
  if (sv === SCHEMA.LOCATION) return C.blue;
  if (sv === SCHEMA.PRODUCT)  return C.yellow;
  if (sv === SCHEMA.COPY)     return C.copy;
  return C.textMuted;
}
function getSchemaIcon(sv: string) {
  if (sv === SCHEMA.PERSON)   return "⬡";
  if (sv === SCHEMA.LOCATION) return "◎";
  if (sv === SCHEMA.PRODUCT)  return "◈";
  if (sv === SCHEMA.COPY)     return "◦";
  return "◻";
}
function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:9999,
      fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",
      background:isActive?"rgba(16,185,129,0.12)":"rgba(245,158,11,0.12)",
      color:isActive?C.green:C.amber,
      border:`1px solid ${isActive?"rgba(16,185,129,0.25)":"rgba(245,158,11,0.25)"}`}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:isActive?C.green:C.amber}}/>
      {status}
    </span>
  );
}
function SchemaTag({ schema_version }: { schema_version: string }) {
  const color = getSchemaColor(schema_version);
  const label = getSchemaLabel(schema_version);
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:4,
      fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",
      background:`${color}18`,color,border:`1px solid ${color}30`,fontFamily:"monospace"}}>
      {getSchemaIcon(schema_version)} {label}
    </span>
  );
}
function LabRoutingBadge({ schema_version }: { schema_version: string }) {
  const labs = LAB_COMPAT[schema_version] || [];
  return (
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {labs.map((lab: string) => (
        <span key={lab} style={{padding:"2px 7px",borderRadius:3,fontSize:9,fontWeight:700,
          letterSpacing:"0.1em",textTransform:"uppercase",background:`${(LAB_COLORS as any)[lab]}15`,
          color:(LAB_COLORS as any)[lab],border:`1px solid ${(LAB_COLORS as any)[lab]}30`,fontFamily:"monospace"}}>
          {lab}
        </span>
      ))}
    </div>
  );
}
function BrandDot({ brandId }: { brandId: string }) {
  const brand = getBrand(brandId);
  if (!brand) return null;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:C.textMuted}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:brand.color,flexShrink:0}}/>
      {brand.label}
    </span>
  );
}
function Btn({ label, onClick, color = C.textMuted, compact = false, disabled = false }: any) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{display:"flex",alignItems:"center",gap:4,padding:compact?"4px 8px":"5px 10px",borderRadius:5,
        border:`1px solid ${h&&!disabled?color+"40":C.border}`,
        background:h&&!disabled?color+"15":"transparent",
        color:disabled?C.textDim:h?color:C.textMuted,
        fontSize:11,cursor:disabled?"not-allowed":"pointer",transition:"all 0.12s",fontFamily:"inherit"}}>
      {label}
    </button>
  );
}
function FormSection({ label, children, accent }: any) {
  return (
    <div style={{marginBottom:20}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",
        color:accent||C.accent,fontFamily:"monospace",marginBottom:12,paddingBottom:6,
        borderBottom:`1px solid ${(accent||C.accent)+"25"}`}}>
        {label}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>{children}</div>
    </div>
  );
}
function FormRow({ label, children }: any) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:8,alignItems:"flex-start"}}>
      <div style={{fontSize:11,color:C.textMuted,paddingTop:7,lineHeight:1.3}}>{label}</div>
      {children}
    </div>
  );
}
function FInput({ value, onChange, placeholder, mono = false }: any) {
  return (
    <input value={value||""} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
      style={{padding:"6px 10px",borderRadius:5,fontSize:12,border:`1px solid ${C.border}`,
        background:C.panel,color:C.text,outline:"none",fontFamily:mono?"monospace":"inherit",
        width:"100%",boxSizing:"border-box"}}/>
  );
}
function FTextarea({ value, onChange, placeholder, rows = 2 }: any) {
  return (
    <textarea value={value||""} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{padding:"6px 10px",borderRadius:5,fontSize:12,border:`1px solid ${C.border}`,
        background:C.panel,color:C.text,outline:"none",fontFamily:"inherit",
        width:"100%",boxSizing:"border-box",resize:"vertical",lineHeight:1.5}}/>
  );
}
function FSelect({ value, onChange, options }: any) {
  return (
    <select value={value} onChange={(e: any) => onChange(e.target.value)}
      style={{padding:"6px 10px",borderRadius:5,fontSize:12,border:`1px solid ${C.border}`,
        background:C.panel,color:C.text,outline:"none",fontFamily:"monospace",width:"100%"}}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function FTagList({ value = [], onChange, placeholder }: any) {
  return (
    <div>
      <FInput value={value.join(", ")}
        onChange={(v: string) => onChange(v.split(",").map((s: string) => s.trim()).filter(Boolean))}
        placeholder={placeholder}/>
      <div style={{fontSize:10,color:C.textDim,marginTop:4}}>Separado por comas</div>
    </div>
  );
}
function FChannelPicker({ label, value = [], onChange, accent }: any) {
  return (
    <div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:6,letterSpacing:"0.08em",
        fontFamily:"monospace",textTransform:"uppercase"}}>{label}</div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {ALL_CHANNELS.map(ch => {
          const active = value.includes(ch);
          return (
            <button key={ch} onClick={() => {
              if (active) onChange(value.filter((c: string) => c !== ch));
              else onChange([...value, ch]);
            }}
              style={{padding:"3px 9px",borderRadius:4,fontSize:10,fontWeight:600,
                cursor:"pointer",fontFamily:"monospace",letterSpacing:"0.08em",
                background:active?(accent||C.copy)+"20":"transparent",
                color:active?(accent||C.copy):C.textDim,
                border:`1px solid ${active?(accent||C.copy)+"50":C.border}`,
                transition:"all 0.1s"}}>
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PERSON DETAIL MODAL ─────────────────────────────────────────────────────
function PersonDetailModal({ bp, onClose }: any) {
  if (!bp || bp.schema_version !== SCHEMA.PERSON) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={(e: any) => e.stopPropagation()}
        style={{width:700,maxHeight:"85vh",overflowY:"auto",background:C.panel,
          border:`1px solid ${C.border}`,borderRadius:14,padding:28,position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:6}}>{bp.displayName}</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <SchemaTag schema_version={bp.schema_version}/>
              <BrandDot brandId={bp.brandId}/>
              <StatusBadge status={bp.status}/>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{background:C.panel2,borderRadius:10,padding:16,marginBottom:16,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",color:C.textDim,fontFamily:"monospace",marginBottom:14,textTransform:"uppercase"}}>
            ⬡ Identidad Unificada — Person Blueprint
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{padding:14,background:C.panel,borderRadius:8,border:`1px solid ${C.yellow}20`}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:C.yellow,fontFamily:"monospace",marginBottom:10,textTransform:"uppercase"}}>
                <span style={{padding:"1px 6px",background:C.yellow+"15",borderRadius:3}}>ImageLab · VideoLab</span>
              </div>
              <div style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:8}}>{bp.imagelab?.description}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[{k:"realism",v:bp.imagelab?.realism_level},{k:"film look",v:bp.imagelab?.film_look},
                  {k:"lens",v:bp.imagelab?.lens_preset},{k:"dof",v:bp.imagelab?.depth_of_field}].map(({k,v}) => (
                  <div key={k}>
                    <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>{k}</div>
                    <div style={{fontSize:11,color:C.yellow,fontFamily:"monospace"}}>{v||"—"}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:14,background:C.panel,borderRadius:8,border:`1px solid ${C.voice}20`}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:C.voice,fontFamily:"monospace",marginBottom:10,textTransform:"uppercase"}}>
                <span style={{padding:"1px 6px",background:C.voice+"15",borderRadius:3}}>VoiceLab</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                {[{k:"voice id",v:bp.voicelab?.voice_id},{k:"language",v:bp.voicelab?.language},
                  {k:"emotion",v:bp.voicelab?.emotion_base},{k:"speed",v:bp.voicelab?.speed}].map(({k,v}) => (
                  <div key={k}>
                    <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>{k}</div>
                    <div style={{fontSize:11,color:C.voice,fontFamily:"monospace"}}>{v||"—"}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",marginBottom:4,letterSpacing:"0.08em",textTransform:"uppercase"}}>speaking style</div>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5,fontStyle:"italic"}}>{bp.voicelab?.speaking_style||"—"}</div>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{padding:12,background:C.panel2,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Expertise</div>
            <div style={{fontSize:12,color:C.textMuted,lineHeight:1.5}}>{bp.expertise||"—"}</div>
          </div>
          <div style={{padding:12,background:C.panel2,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Compatible Archetypes</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {(bp.compatible_archetypes||[]).map((a: string) => (
                <span key={a} style={{padding:"2px 7px",borderRadius:3,fontSize:10,background:C.accentDim,color:C.accentBright,fontFamily:"monospace"}}>{a}</span>
              ))}
            </div>
          </div>
        </div>
        {bp.compliance_notes && (
          <div style={{padding:10,background:"rgba(245,158,11,0.08)",borderRadius:7,border:"1px solid rgba(245,158,11,0.2)"}}>
            <div style={{fontSize:9,color:C.amber,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>⚠ Compliance</div>
            <div style={{fontSize:11,color:C.amber}}>{bp.compliance_notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COPY DETAIL MODAL ───────────────────────────────────────────────────────
function CopyDetailModal({ bp, allBps, onClose }: any) {
  if (!bp || bp.schema_version !== SCHEMA.COPY) return null;
  const personBp = allBps.find((b: any) => b.id === bp.inherits_from_person);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={(e: any) => e.stopPropagation()}
        style={{width:740,maxHeight:"88vh",overflowY:"auto",background:C.panel,
          border:`1px solid ${C.border}`,borderRadius:14,padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:6}}>{bp.displayName}</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <SchemaTag schema_version={bp.schema_version}/>
              <BrandDot brandId={bp.brandId}/>
              <StatusBadge status={bp.status}/>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        {personBp && (
          <div style={{padding:"8px 12px",background:`${C.accentDim}`,borderRadius:7,border:`1px solid ${C.accent}30`,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:C.accentBright}}>⬡</span>
            <div style={{fontSize:11,color:C.accentBright}}>
              Hereda voz de: <strong>{personBp.displayName}</strong>
              <span style={{color:C.textMuted,marginLeft:8,fontSize:10,fontFamily:"monospace"}}>{bp.inherits_from_person}</span>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <div style={{padding:14,background:C.panel2,borderRadius:8,border:`1px solid ${C.copy}20`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:C.copy,fontFamily:"monospace",marginBottom:10,textTransform:"uppercase"}}>
              <span style={{padding:"1px 6px",background:C.copy+"15",borderRadius:3}}>CopyLab — Voz</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[{k:"tone primary",v:bp.voice?.tone_primary},{k:"tone secondary",v:bp.voice?.tone_secondary},
                {k:"writing style",v:bp.voice?.writing_style},{k:"pov",v:bp.voice?.pov}].map(({k,v}) => (
                <div key={k}>
                  <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>{k}</div>
                  <div style={{fontSize:11,color:C.copy,fontFamily:"monospace"}}>{v||"—"}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{padding:14,background:C.panel2,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:C.textDim,fontFamily:"monospace",marginBottom:10,textTransform:"uppercase"}}>Idioma · Geo</div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",textTransform:"uppercase",marginBottom:2}}>primary</div>
              <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"monospace"}}>{bp.language?.primary||"—"}</div>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",textTransform:"uppercase",marginBottom:2}}>variantes</div>
              <div style={{display:"flex",gap:4}}>
                {(bp.language?.variants||[]).map((v: string) => <span key={v} style={{padding:"2px 7px",borderRadius:3,fontSize:10,background:C.accentDim,color:C.accentBright,fontFamily:"monospace"}}>{v}</span>)}
              </div>
            </div>
            <div>
              <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",textTransform:"uppercase",marginBottom:2}}>geo default</div>
              <div style={{fontSize:11,color:C.textMuted}}>{bp.language?.geo_default||"—"}</div>
            </div>
          </div>
        </div>
        <div style={{padding:14,background:C.panel2,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:C.textDim,fontFamily:"monospace",marginBottom:12,textTransform:"uppercase"}}>Canales</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[["primary",bp.channels?.primary,C.green],["secondary",bp.channels?.secondary,C.amber],["excluded",bp.channels?.excluded,C.red]].map(([label,chs,color]: any) => (
              <div key={label}>
                <div style={{fontSize:9,color,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {(chs||[]).length===0
                    ? <span style={{fontSize:10,color:C.textDim}}>—</span>
                    : (chs||[]).map((ch: string) => <span key={ch} style={{padding:"2px 6px",borderRadius:3,fontSize:9,fontFamily:"monospace",background:`${color}15`,color,border:`1px solid ${color}20`}}>{ch}</span>)
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:14,background:C.panel2,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:C.textDim,fontFamily:"monospace",marginBottom:12,textTransform:"uppercase"}}>Estilo de Escritura</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
            {[{k:"sentence length",v:bp.style?.sentence_length},{k:"emoji usage",v:bp.style?.emoji_usage},
              {k:"hashtag style",v:bp.style?.hashtag_style},{k:"cta style",v:bp.style?.cta_style}].map(({k,v}) => (
              <div key={k}>
                <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>{k}</div>
                <div style={{fontSize:11,color:C.text,fontFamily:"monospace"}}>{v||"—"}</div>
              </div>
            ))}
          </div>
          {bp.style?.hooks?.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>hooks</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {bp.style.hooks.map((h: string) => <span key={h} style={{padding:"2px 7px",borderRadius:3,fontSize:10,background:C.accentDim,color:C.accentBright}}>{h}</span>)}
              </div>
            </div>
          )}
          {bp.style?.signature_phrases?.length > 0 && (
            <div>
              <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>frases firma</div>
              {bp.style.signature_phrases.map((p: string) => <div key={p} style={{fontSize:11,color:C.textMuted,fontStyle:"italic",marginBottom:2}}>"{p}"</div>)}
            </div>
          )}
        </div>
        <div style={{padding:12,background:"rgba(245,158,11,0.08)",borderRadius:7,border:"1px solid rgba(245,158,11,0.2)"}}>
          <div style={{fontSize:9,color:C.amber,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>⚠ Compliance</div>
          <div style={{fontSize:11,color:C.amber,marginBottom:bp.compliance?.prohibited_words?.length?8:0}}>{bp.compliance?.rules||"—"}</div>
          {bp.compliance?.prohibited_words?.length > 0 && (
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {bp.compliance.prohibited_words.map((w: string) => <span key={w} style={{padding:"2px 6px",borderRadius:3,fontSize:9,background:"rgba(239,68,68,0.15)",color:C.red,fontFamily:"monospace"}}>✗ {w}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REGISTRY TAB ────────────────────────────────────────────────────────────
function RegistryTab({ blueprints, onEdit, onDelete, onClone, onExport, onExportAll }: any) {
  const [filterType,  setFilterType]  = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [search,      setSearch]      = useState("");
  const [detailBp,    setDetailBp]    = useState<any>(null);

  const filtered = blueprints.filter((bp: any) => {
    const typeMatch  = filterType === "all" || getSchemaLabel(bp.schema_version) === filterType;
    const brandMatch = filterBrand === "all" || bp.brandId === filterBrand;
    const searchMatch = !search || bp.displayName.toLowerCase().includes(search.toLowerCase()) || bp.id.toLowerCase().includes(search.toLowerCase());
    return typeMatch && brandMatch && searchMatch;
  });
  const counts: any = {
    PERSON:   blueprints.filter((b: any) => b.schema_version === SCHEMA.PERSON).length,
    LOCATION: blueprints.filter((b: any) => b.schema_version === SCHEMA.LOCATION).length,
    PRODUCT:  blueprints.filter((b: any) => b.schema_version === SCHEMA.PRODUCT).length,
    COPY:     blueprints.filter((b: any) => b.schema_version === SCHEMA.COPY).length,
  };
  const detailIsCopy   = detailBp?.schema_version === SCHEMA.COPY;
  const detailIsPerson = detailBp?.schema_version === SCHEMA.PERSON;

  return (
    <div style={{padding:24,height:"100%",overflowY:"auto",boxSizing:"border-box"}}>
      {detailIsPerson && <PersonDetailModal bp={detailBp} onClose={() => setDetailBp(null)}/>}
      {detailIsCopy   && <CopyDetailModal  bp={detailBp} allBps={blueprints} onClose={() => setDetailBp(null)}/>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {["PERSON","LOCATION","PRODUCT","COPY"].map(type => {
          const sv = SCHEMA[type as keyof typeof SCHEMA];
          const color = getSchemaColor(sv);
          const active = filterType === type;
          return (
            <div key={type} onClick={() => setFilterType(active ? "all" : type)}
              style={{padding:"14px 18px",borderRadius:10,cursor:"pointer",
                background:active?`${color}15`:C.panel2,
                border:`1px solid ${active?color+"40":C.border}`,transition:"all 0.15s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:24,fontWeight:800,color,fontFamily:"monospace"}}>{counts[type]}</span>
                <span style={{fontSize:18,opacity:0.4}}>{getSchemaIcon(sv)}</span>
              </div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",
                color:active?color:C.textMuted,marginTop:4,textTransform:"uppercase",fontFamily:"monospace"}}>
                {type}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Buscar ID o nombre..."
          style={{flex:1,minWidth:180,padding:"8px 12px",borderRadius:6,fontSize:12,
            background:C.panel2,border:`1px solid ${C.border}`,color:C.text,outline:"none",fontFamily:"inherit"}}/>
        <select value={filterBrand} onChange={(e: any) => setFilterBrand(e.target.value)}
          style={{padding:"8px 12px",borderRadius:6,fontSize:12,background:C.panel2,border:`1px solid ${C.border}`,color:C.text,outline:"none"}}>
          <option value="all">Todas las marcas</option>
          {BRANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <button onClick={() => { setSearch(""); setFilterBrand("all"); setFilterType("all"); }}
          style={{padding:"8px 14px",borderRadius:6,background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>
          ↺ Reset
        </button>
        <button onClick={() => onExportAll(filtered)}
          style={{padding:"8px 14px",borderRadius:6,background:C.accentDim,border:`1px solid ${C.accent}40`,
            color:C.accentBright,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>
          ↓ Export {filtered.length === blueprints.length ? "All" : `${filtered.length} filtered`}
        </button>
      </div>
      {filtered.length === 0 ? (
        <div style={{textAlign:"center",color:C.textDim,padding:"60px 20px",fontSize:13}}>
          <div style={{fontSize:32,marginBottom:8}}>◻</div>No se encontraron blueprints
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
          {filtered.map((bp: any) => (
            <BpCard key={bp.id} bp={bp}
              onEdit={onEdit} onDelete={onDelete} onClone={onClone} onExport={onExport}
              onDetail={() => setDetailBp(bp)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function BpCard({ bp, onEdit, onDelete, onClone, onExport, onDetail }: any) {
  const [hover, setHover] = useState(false);
  const brand = getBrand(bp.brandId);
  const isPerson = bp.schema_version === SCHEMA.PERSON;
  const isCopy   = bp.schema_version === SCHEMA.COPY;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{background:hover?C.panel2:C.panel,
        border:`1px solid ${hover?C.borderHover:C.border}`,
        borderRadius:10,padding:"16px 18px",transition:"all 0.15s",position:"relative",overflow:"hidden"}}>
      {brand && <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:brand.color,borderRadius:"10px 0 0 10px"}}/>}
      <div style={{paddingLeft:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{bp.displayName}</div>
            <div style={{fontSize:10,fontFamily:"monospace",color:C.textDim}}>{bp.id}</div>
          </div>
          <StatusBadge status={bp.status}/>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          <SchemaTag schema_version={bp.schema_version}/>
          <BrandDot brandId={bp.brandId}/>
        </div>
        {isPerson && (
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5,marginBottom:6}}>
              <span style={{color:C.textDim,fontFamily:"monospace",fontSize:10}}>role: </span>
              <span style={{color:C.accentBright}}>{bp.role_default}</span>
              {bp.expertise && <div style={{marginTop:2}}>{bp.expertise.length>60?bp.expertise.slice(0,60)+"…":bp.expertise}</div>}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",padding:"5px 8px",background:`${C.voice}0d`,borderRadius:5,border:`1px solid ${C.voice}20`}}>
              <span style={{fontSize:9,fontWeight:700,color:C.voice,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>voice →</span>
              <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>{bp.voicelab?.language||"—"}</span>
              <span style={{fontSize:10,color:C.voice,fontFamily:"monospace"}}>{bp.voicelab?.emotion_base||"—"}</span>
              <span style={{fontSize:10,color:C.textDim,fontFamily:"monospace"}}>×{bp.voicelab?.speed||1.0}</span>
            </div>
          </div>
        )}
        {bp.schema_version === SCHEMA.LOCATION && (
          <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5,marginBottom:10}}>
            <span style={{color:C.textDim,fontFamily:"monospace",fontSize:10}}>loc: </span>
            {bp.city}, {bp.country} · <span style={{color:C.blue}}>{bp.locationType}</span>
          </div>
        )}
        {bp.schema_version === SCHEMA.PRODUCT && (
          <div style={{fontSize:11,color:C.textMuted,marginBottom:10}}>
            <span style={{color:C.textDim,fontFamily:"monospace",fontSize:10}}>scenarios: </span>{bp.scenarios?.length||0}
            {bp.transparencySensitive && <span style={{marginLeft:8,color:C.amber}}>⚠ transparency</span>}
          </div>
        )}
        {isCopy && (
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
              <span style={{fontSize:9,fontWeight:700,color:C.copy,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>copy →</span>
              <span style={{padding:"1px 6px",borderRadius:3,fontSize:10,background:`${C.copy}15`,color:C.copy,fontFamily:"monospace"}}>{bp.voice?.tone_primary||"—"}</span>
              <span style={{padding:"1px 6px",borderRadius:3,fontSize:10,background:`${C.copy}08`,color:C.textMuted,fontFamily:"monospace"}}>{bp.language?.primary||"—"}</span>
              <span style={{padding:"1px 6px",borderRadius:3,fontSize:10,background:`${C.copy}08`,color:C.textMuted,fontFamily:"monospace"}}>{bp.voice?.writing_style||"—"}</span>
            </div>
            {bp.channels?.primary?.length > 0 && (
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {bp.channels.primary.slice(0,3).map((ch: string) => (
                  <span key={ch} style={{padding:"1px 6px",borderRadius:3,fontSize:9,background:`${C.green}10`,color:C.green,fontFamily:"monospace",letterSpacing:"0.06em"}}>{ch}</span>
                ))}
                {bp.channels.primary.length > 3 && <span style={{fontSize:9,color:C.textDim}}>+{bp.channels.primary.length-3}</span>}
              </div>
            )}
            {bp.inherits_from_person && (
              <div style={{marginTop:5,fontSize:10,color:C.textDim}}>
                <span style={{color:C.accentBright}}>⬡</span> hereda de <span style={{fontFamily:"monospace",color:C.accentBright}}>{bp.inherits_from_person}</span>
              </div>
            )}
          </div>
        )}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:5}}>→ compatible labs</div>
          <LabRoutingBadge schema_version={bp.schema_version}/>
        </div>
        <div style={{display:"flex",gap:5,borderTop:`1px solid ${C.border}`,paddingTop:10,flexWrap:"wrap"}}>
          <Btn label={isCopy?"◦ Voice Card":"⬡ Identity"} onClick={onDetail} color={isCopy?C.copy:C.accentBright} compact/>
          <Btn label="↓ Export" onClick={() => onExport(bp)} color={C.accentBright} compact/>
          <Btn label="⊕ Clone"  onClick={() => onClone(bp)} color={C.green} compact/>
          <Btn label="✎ Edit"   onClick={() => onEdit(bp)}  color={C.textMuted} compact/>
          <Btn label="✕"        onClick={() => onDelete(bp)} color={C.red} compact/>
        </div>
      </div>
    </div>
  );
}

// ─── BUILDER TAB ─────────────────────────────────────────────────────────────
function BuilderTab({ onSave, editingBp, onCancelEdit }: any) {
  const [bpType, setBpType] = useState(editingBp ? getSchemaLabel(editingBp.schema_version) : "PERSON");
  const getDefault = (type: string) => ({
    schema_version: SCHEMA[type as keyof typeof SCHEMA],
    id: "", brandId: BRANDS[0].id, displayName: "", status: "draft",
  });
  const [form, setForm] = useState<any>(editingBp ? { ...editingBp } : getDefault("PERSON"));
  useEffect(() => {
    if (editingBp) { setForm({ ...editingBp }); setBpType(getSchemaLabel(editingBp.schema_version)); }
  }, [editingBp]);
  const setField = (path: string, value: any) => {
    setForm((prev: any) => {
      const parts = path.split(".");
      if (parts.length === 1) return { ...prev, [path]: value };
      const updated = { ...prev };
      let cur: any = updated;
      for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = { ...(cur[parts[i]] || {}) }; cur = cur[parts[i]]; }
      cur[parts[parts.length - 1]] = value;
      return updated;
    });
  };
  const switchType = (type: string) => { setBpType(type); setForm(getDefault(type)); };
  const handleSave = () => {
    if (!form.displayName || !form.brandId) { alert("displayName y brandId son requeridos."); return; }
    const id = form.id || safeId(bpType.toLowerCase());
    onSave({ ...form, id });
  };
  return (
    <div style={{padding:24,height:"100%",overflowY:"auto",boxSizing:"border-box"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:10}}>TIPO DE BLUEPRINT</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["PERSON","LOCATION","PRODUCT","COPY"].map(type => {
            const isActive = bpType === type;
            const color = getSchemaColor(SCHEMA[type as keyof typeof SCHEMA]);
            return (
              <button key={type} onClick={() => switchType(type)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:7,
                  border:`1px solid ${isActive?color+"60":C.border}`,background:isActive?color+"18":C.panel2,
                  color:isActive?color:C.textMuted,fontSize:12,fontWeight:700,letterSpacing:"0.08em",
                  textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s",fontFamily:"inherit"}}>
                {getSchemaIcon(SCHEMA[type as keyof typeof SCHEMA])} {type}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 400px",gap:24}}>
        <div>
          <FormSection label="Identificación Base">
            <FormRow label="Display Name *"><FInput value={form.displayName} onChange={(v: string) => setField("displayName",v)} placeholder="ej: Patricia Osorio"/></FormRow>
            <FormRow label="ID (slug)"><FInput value={form.id} onChange={(v: string) => setField("id",v)} placeholder="auto-generado si vacío" mono/></FormRow>
            <FormRow label="Brand *"><FSelect value={form.brandId} onChange={(v: string) => setField("brandId",v)} options={BRANDS.map(b => ({value:b.id,label:b.label}))}/></FormRow>
            <FormRow label="Status"><FSelect value={form.status||"draft"} onChange={(v: string) => setField("status",v)} options={[{value:"active",label:"active"},{value:"draft",label:"draft"}]}/></FormRow>
          </FormSection>
          {bpType === "PERSON"   && <PersonFields form={form} setField={setField}/>}
          {bpType === "LOCATION" && <LocationFields form={form} setField={setField}/>}
          {bpType === "PRODUCT"  && <ProductFields form={form} setField={setField}/>}
          {bpType === "COPY"     && <CopyFields form={form} setField={setField}/>}
        </div>
        <div style={{position:"sticky",top:0}}>
          <div style={{fontSize:11,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:10}}>JSON PREVIEW</div>
          <div style={{background:"#040507",border:`1px solid ${C.border}`,borderRadius:8,padding:14,
            fontFamily:"monospace",fontSize:10.5,color:"#A78BFA",lineHeight:1.6,
            maxHeight:340,overflowY:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
            {JSON.stringify(form,null,2)}
          </div>
          <div style={{marginTop:12,padding:12,background:C.panel2,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>→ Labs destino</div>
            <LabRoutingBadge schema_version={form.schema_version}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:14}}>
            <button onClick={handleSave}
              style={{flex:1,padding:"10px 0",borderRadius:7,background:C.accent,color:"#fff",
                border:"none",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:"0.05em",fontFamily:"inherit"}}>
              {editingBp ? "Actualizar" : "Guardar Blueprint"}
            </button>
            <button onClick={() => setForm(editingBp ? { ...editingBp } : getDefault(bpType))}
              style={{padding:"10px 16px",borderRadius:7,background:"transparent",color:C.textMuted,
                border:`1px solid ${C.border}`,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              ↺ Reset
            </button>
            {editingBp && (
              <button onClick={onCancelEdit}
                style={{padding:"10px 16px",borderRadius:7,background:"transparent",color:C.textMuted,
                  border:`1px solid ${C.border}`,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// PersonFields, LocationFields, ProductFields, CopyFields — identical to original
function PersonFields({ form, setField }: any) {
  return (
    <>
      <FormSection label="Persona">
        <FormRow label="Role Default"><FSelect value={form.role_default||"BOTH"} onChange={(v: string) => setField("role_default",v)} options={["HOST","GUEST","BOTH"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Expertise"><FInput value={form.expertise} onChange={(v: string) => setField("expertise",v)} placeholder="áreas separadas por coma"/></FormRow>
        <FormRow label="Compliance Notes"><FInput value={form.compliance_notes} onChange={(v: string) => setField("compliance_notes",v)} placeholder="No medical claims..."/></FormRow>
        <FormRow label="Compatible Archetypes"><FTagList value={form.compatible_archetypes||[]} onChange={(v: string[]) => setField("compatible_archetypes",v)} placeholder="studio_setup, salon_workshop, ..."/></FormRow>
      </FormSection>
      <FormSection label="⸢ ImageLab · VideoLab — Visual Identity" accent={C.yellow}>
        <FormRow label="Descripción física"><FTextarea value={form.imagelab?.description} onChange={(v: string) => setField("imagelab.description",v)} rows={3} placeholder="Descripción visual del personaje..."/></FormRow>
        <FormRow label="Style tags"><FInput value={form.imagelab?.style} onChange={(v: string) => setField("imagelab.style",v)} placeholder="editorial_clean, warm tones..."/></FormRow>
        <FormRow label="Realism Level"><FSelect value={form.imagelab?.realism_level||"editorial_clean"} onChange={(v: string) => setField("imagelab.realism_level",v)} options={["editorial_clean","cinematic","documentary"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Film Look"><FSelect value={form.imagelab?.film_look||"digital_clean"} onChange={(v: string) => setField("imagelab.film_look",v)} options={["digital_clean","35mm_film","cinematic_soft"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Lens Preset"><FSelect value={form.imagelab?.lens_preset||"50mm_lifestyle"} onChange={(v: string) => setField("imagelab.lens_preset",v)} options={["50mm_lifestyle","35mm_hero","85mm_portrait","24mm_wide","100mm_macro"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Depth of Field"><FSelect value={form.imagelab?.depth_of_field||"shallow"} onChange={(v: string) => setField("imagelab.depth_of_field",v)} options={["deep","medium","shallow"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Skin Detail"><FSelect value={form.imagelab?.skin_detail||"realistic"} onChange={(v: string) => setField("imagelab.skin_detail",v)} options={["subtle","realistic","high_microdetail"].map(o => ({value:o,label:o}))}/></FormRow>
      </FormSection>
      <FormSection label="⸢ VoiceLab — Voice Identity" accent={C.voice}>
        <FormRow label="Voice ID"><FInput value={form.voicelab?.voice_id} onChange={(v: string) => setField("voicelab.voice_id",v)} placeholder="TBD_voice_id" mono/></FormRow>
        <FormRow label="Language"><FSelect value={form.voicelab?.language||"es-ES"} onChange={(v: string) => setField("voicelab.language",v)} options={["es-ES","es-FL","en-US","SPANG"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Emotion Base"><FSelect value={form.voicelab?.emotion_base||"warm"} onChange={(v: string) => setField("voicelab.emotion_base",v)} options={["warm","authoritative","energetic","calm","conversational","friendly"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Speed"><FInput value={form.voicelab?.speed??1.0} onChange={(v: string) => setField("voicelab.speed",parseFloat(v)||1.0)} placeholder="1.0" mono/></FormRow>
        <FormRow label="Script Style"><FInput value={form.voicelab?.script_style} onChange={(v: string) => setField("voicelab.script_style",v)} placeholder="conversational"/></FormRow>
        <FormRow label="Speaking Style"><FTextarea value={form.voicelab?.speaking_style} onChange={(v: string) => setField("voicelab.speaking_style",v)} rows={2} placeholder="AUTHORITY_EDU — descripción..."/></FormRow>
      </FormSection>
    </>
  );
}
function LocationFields({ form, setField }: any) {
  return (
    <>
      <FormSection label="Ubicación">
        <FormRow label="Location Type"><FSelect value={form.locationType||"studio"} onChange={(v: string) => setField("locationType",v)} options={["salon","workshop","exterior_urban","exterior_coastal","event_stage","studio","residential"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="City"><FInput value={form.city} onChange={(v: string) => setField("city",v)} placeholder="Miami, Madrid, Panama City..."/></FormRow>
        <FormRow label="Country"><FInput value={form.country} onChange={(v: string) => setField("country",v)} placeholder="USA, ES, PA..."/></FormRow>
        <FormRow label="Compatible Archetypes"><FTagList value={form.compatible_archetypes||[]} onChange={(v: string[]) => setField("compatible_archetypes",v)} placeholder="studio_setup, salon_workshop, ..."/></FormRow>
        <FormRow label="Recommended Angles"><FTagList value={form.recommended_angles||[]} onChange={(v: string[]) => setField("recommended_angles",v)} placeholder="silla_espejo, two_shot, ..."/></FormRow>
      </FormSection>
      <FormSection label="⸢ Visual Description" accent={C.blue}>
        <FormRow label="Descripción"><FTextarea value={form.visual?.description} onChange={(v: string) => setField("visual.description",v)} rows={3} placeholder="Descripción visual del espacio..."/></FormRow>
        <FormRow label="Materials"><FTagList value={form.visual?.materials||[]} onChange={(v: string[]) => setField("visual.materials",v)} placeholder="cristal, cuero blanco, metal dorado"/></FormRow>
        <FormRow label="Color Palette"><FTagList value={form.visual?.color_palette||[]} onChange={(v: string[]) => setField("visual.color_palette",v)} placeholder="blanco, dorado, verde tropical"/></FormRow>
        <FormRow label="Lighting"><FInput value={form.visual?.lighting} onChange={(v: string) => setField("visual.lighting",v)} placeholder="cálida controlada..."/></FormRow>
        <FormRow label="Best Time of Day"><FSelect value={form.visual?.time_of_day_best||"tarde"} onChange={(v: string) => setField("visual.time_of_day_best",v)} options={["mañana","tarde","golden hour","noche","mediodía"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Signature Elements"><FTagList value={form.visual?.signature_elements||[]} onChange={(v: string[]) => setField("visual.signature_elements",v)} placeholder="palmeras icónicas, agua turquesa"/></FormRow>
      </FormSection>
      <FormSection label="⸢ ImageLab Config" accent={C.yellow}>
        <FormRow label="Realism Level"><FSelect value={form.imagelab?.realism_level||"editorial_clean"} onChange={(v: string) => setField("imagelab.realism_level",v)} options={["editorial_clean","cinematic","documentary"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Film Look"><FSelect value={form.imagelab?.film_look||"digital_clean"} onChange={(v: string) => setField("imagelab.film_look",v)} options={["digital_clean","35mm_film","cinematic_soft"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Lens Preset"><FSelect value={form.imagelab?.lens_preset||"50mm_lifestyle"} onChange={(v: string) => setField("imagelab.lens_preset",v)} options={["50mm_lifestyle","35mm_hero","85mm_portrait","24mm_wide"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Depth of Field"><FSelect value={form.imagelab?.depth_of_field||"medium"} onChange={(v: string) => setField("imagelab.depth_of_field",v)} options={["deep","medium","shallow"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Framing"><FSelect value={form.imagelab?.framing||"rule_of_thirds"} onChange={(v: string) => setField("imagelab.framing",v)} options={["centered","rule_of_thirds","negative_space_left","negative_space_right"].map(o => ({value:o,label:o}))}/></FormRow>
      </FormSection>
    </>
  );
}
function ProductFields({ form, setField }: any) {
  return (
    <>
      <FormSection label="Producto">
        <FormRow label="Transparency Sensitive">
          <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:6}}>
            <input type="checkbox" checked={!!form.transparencySensitive} onChange={(e: any) => setField("transparencySensitive",e.target.checked)} style={{accentColor:C.accent,width:14,height:14}}/>
            <span style={{fontSize:12,color:C.textMuted}}>Activar (tapas transparentes, etc.)</span>
          </div>
        </FormRow>
      </FormSection>
      <FormSection label="Composite Params" accent={C.yellow}>
        {[{key:"defaultCompositeParams.scale",label:"Scale",ph:"1.2"},{key:"defaultCompositeParams.offsetX",label:"Offset X (px)",ph:"0"},
          {key:"defaultCompositeParams.offsetY",label:"Offset Y (px)",ph:"150"},{key:"defaultCompositeParams.shadowOpacity",label:"Shadow Opacity",ph:"0.5"},
          {key:"defaultCompositeParams.shadowBlur",label:"Shadow Blur (px)",ph:"20"},{key:"defaultCompositeParams.aoOpacity",label:"AO Opacity",ph:"0.7"}].map(({key,label,ph}) => (
          <FormRow key={key} label={label}>
            <FInput value={(key.split(".").reduce((o: any,k: string) => o?.[k], form))??""} onChange={(v: string) => setField(key,parseFloat(v)||0)} placeholder={ph} mono/>
          </FormRow>
        ))}
      </FormSection>
    </>
  );
}
function CopyFields({ form, setField }: any) {
  return (
    <>
      <FormSection label="⸢ Voice Identity" accent={C.copy}>
        <FormRow label="Hereda de Person"><FInput value={form.inherits_from_person||""} onChange={(v: string) => setField("inherits_from_person",v||null)} placeholder="ID del Person blueprint (opcional)" mono/></FormRow>
        <FormRow label="Tone Primary"><FSelect value={form.voice?.tone_primary||"warm"} onChange={(v: string) => setField("voice.tone_primary",v)} options={["authoritative","warm","conversational","energetic","calm","technical"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Tone Secondary"><FSelect value={form.voice?.tone_secondary||"conversational"} onChange={(v: string) => setField("voice.tone_secondary",v)} options={["authoritative","warm","conversational","energetic","calm","technical"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Writing Style"><FInput value={form.voice?.writing_style||""} onChange={(v: string) => setField("voice.writing_style",v)} placeholder="AUTHORITY_EDU, LUXURY_EXPERT..." mono/></FormRow>
        <FormRow label="POV"><FSelect value={form.voice?.pov||"brand"} onChange={(v: string) => setField("voice.pov",v)} options={["first_person","second_person","brand"].map(o => ({value:o,label:o}))}/></FormRow>
      </FormSection>
      <FormSection label="⸢ Idioma · Geo" accent={C.accentBright}>
        <FormRow label="Primary Language"><FSelect value={form.language?.primary||"es-ES"} onChange={(v: string) => setField("language.primary",v)} options={["es-ES","es-FL","en-US","SPANG"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Variantes"><FTagList value={form.language?.variants||[]} onChange={(v: string[]) => setField("language.variants",v)} placeholder="es-FL, SPANG, EN"/></FormRow>
        <FormRow label="Geo Default"><FInput value={form.language?.geo_default||""} onChange={(v: string) => setField("language.geo_default",v)} placeholder="Miami, FL · España"/></FormRow>
      </FormSection>
      <FormSection label="⸢ Canales" accent={C.green}>
        <div style={{marginBottom:12}}><FChannelPicker label="Primarios" value={form.channels?.primary||[]} onChange={(v: string[]) => setField("channels.primary",v)} accent={C.green}/></div>
        <div style={{marginBottom:12}}><FChannelPicker label="Secundarios" value={form.channels?.secondary||[]} onChange={(v: string[]) => setField("channels.secondary",v)} accent={C.amber}/></div>
        <div><FChannelPicker label="Excluidos" value={form.channels?.excluded||[]} onChange={(v: string[]) => setField("channels.excluded",v)} accent={C.red}/></div>
      </FormSection>
      <FormSection label="⸢ Estilo de Escritura" accent={C.copy}>
        <FormRow label="Sentence Length"><FSelect value={form.style?.sentence_length||"mixed"} onChange={(v: string) => setField("style.sentence_length",v)} options={["short","mixed","long"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Emoji Usage"><FSelect value={form.style?.emoji_usage||"minimal"} onChange={(v: string) => setField("style.emoji_usage",v)} options={["none","minimal","moderate","heavy"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Hashtag Style"><FSelect value={form.style?.hashtag_style||"niche_specific"} onChange={(v: string) => setField("style.hashtag_style",v)} options={["none","broad","niche_specific"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="CTA Style"><FSelect value={form.style?.cta_style||"soft_authority"} onChange={(v: string) => setField("style.cta_style",v)} options={["aggressive","soft_authority","community","discovery"].map(o => ({value:o,label:o}))}/></FormRow>
        <FormRow label="Hooks"><FTagList value={form.style?.hooks||[]} onChange={(v: string[]) => setField("style.hooks",v)} placeholder="pregunta retórica, dato impactante, ..."/></FormRow>
        <FormRow label="Frases Firma"><FTagList value={form.style?.signature_phrases||[]} onChange={(v: string[]) => setField("style.signature_phrases",v)} placeholder="El secreto está en..., Y eso lo cambia todo."/></FormRow>
        <FormRow label="Evitar Frases"><FTagList value={form.style?.avoid_phrases||[]} onChange={(v: string[]) => setField("style.avoid_phrases",v)} placeholder="garantizado, milagro, ..."/></FormRow>
      </FormSection>
      <FormSection label="⸢ Compliance" accent={C.amber}>
        <FormRow label="Rules"><FTextarea value={form.compliance?.rules||""} onChange={(v: string) => setField("compliance.rules",v)} rows={2} placeholder="No medical claims. Cosmetic claims only."/></FormRow>
        <FormRow label="Palabras Prohibidas"><FTagList value={form.compliance?.prohibited_words||[]} onChange={(v: string[]) => setField("compliance.prohibited_words",v)} placeholder="cura, elimina, garantizado, médico"/></FormRow>
        <FormRow label="Disclaimers"><FTagList value={form.compliance?.required_disclaimers||[]} onChange={(v: string[]) => setField("compliance.required_disclaimers",v)} placeholder="Resultados pueden variar."/></FormRow>
      </FormSection>
    </>
  );
}

// ─── EXPORT TAB ──────────────────────────────────────────────────────────────
function ExportTab({ blueprints, initialSelected }: any) {
  const [selectedId,  setSelectedId]  = useState(initialSelected || blueprints[0]?.id || "");
  const [copied,      setCopied]      = useState(false);
  const [prettyPrint, setPrettyPrint] = useState(true);
  useEffect(() => { if (initialSelected) setSelectedId(initialSelected); }, [initialSelected]);
  const selected = blueprints.find((b: any) => b.id === selectedId);
  const json = selected ? JSON.stringify(selected, null, prettyPrint ? 2 : 0) : "";
  const copyToClipboard = () => {
    navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const downloadThis = () => { if (selected) downloadJson(selected, `${selected.id}.blueprint.json`); };
  const grouped: any = {
    COPY: blueprints.filter((b: any) => b.schema_version === SCHEMA.COPY),
    PERSON: blueprints.filter((b: any) => b.schema_version === SCHEMA.PERSON),
    LOCATION: blueprints.filter((b: any) => b.schema_version === SCHEMA.LOCATION),
    PRODUCT: blueprints.filter((b: any) => b.schema_version === SCHEMA.PRODUCT),
  };
  return (
    <div style={{padding:24,height:"100%",overflowY:"auto",boxSizing:"border-box"}}>
      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:20,minHeight:400}}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace"}}>SELECCIONAR BLUEPRINT</div>
            {selectedId && <button onClick={() => setSelectedId("")} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:10,fontFamily:"monospace",textTransform:"uppercase",padding:0}}>↺ Reset</button>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {Object.entries(grouped).map(([type, bps]: any) => bps.length === 0 ? null : (
              <div key={type}>
                <div style={{fontSize:9,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.12em",textTransform:"uppercase",padding:"6px 4px 4px",marginTop:6}}>{getSchemaIcon(SCHEMA[type as keyof typeof SCHEMA])} {type}</div>
                {bps.map((bp: any) => {
                  const brand = getBrand(bp.brandId);
                  const isSelected = bp.id === selectedId;
                  return (
                    <button key={bp.id} onClick={() => setSelectedId(bp.id)}
                      style={{padding:"8px 10px",borderRadius:6,textAlign:"left",cursor:"pointer",width:"100%",
                        background:isSelected?C.accentDim:C.panel2,border:`1px solid ${isSelected?C.accent+"60":C.border}`,
                        borderLeft:brand?`3px solid ${brand.color}`:`3px solid ${C.border}`,
                        transition:"all 0.12s",fontFamily:"inherit",marginBottom:3}}>
                      <div style={{fontSize:11,fontWeight:600,color:isSelected?C.accentBright:C.text,lineHeight:1.3}}>{bp.displayName}</div>
                      <div style={{display:"flex",gap:5,marginTop:3,alignItems:"center"}}><StatusBadge status={bp.status}/></div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div>
          {selected ? (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{selected.displayName}</div>
                  <div style={{display:"flex",gap:8,marginTop:4}}><SchemaTag schema_version={selected.schema_version}/><BrandDot brandId={selected.brandId}/></div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <button onClick={() => setPrettyPrint(!prettyPrint)} style={{padding:"5px 10px",borderRadius:5,fontSize:11,background:C.panel2,border:`1px solid ${C.border}`,color:C.textMuted,cursor:"pointer",fontFamily:"inherit"}}>{prettyPrint?"Minify":"Prettify"}</button>
                  <button onClick={downloadThis} style={{padding:"7px 14px",borderRadius:6,background:`${C.green}15`,border:`1px solid ${C.green}40`,color:C.green,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>↓ Download .json</button>
                  <button onClick={copyToClipboard} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:6,background:copied?"rgba(16,185,129,0.2)":C.accentDim,border:`1px solid ${copied?C.green+"50":C.accent+"50"}`,color:copied?C.green:C.accentBright,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit"}}>{copied?"✓ Copiado":"⌘ Copy JSON"}</button>
                </div>
              </div>
              <div style={{padding:"10px 14px",background:C.panel2,borderRadius:7,border:`1px solid ${C.border}`,marginBottom:12}}>
                <div style={{fontSize:10,color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>→ Pegar en BlueprintInputPanel de:</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {(LAB_COMPAT[selected.schema_version]||[]).map((lab: string) => (
                    <div key={lab} style={{display:"flex",flexDirection:"column",padding:"8px 14px",borderRadius:6,background:(LAB_COLORS as any)[lab]+"12",border:`1px solid ${(LAB_COLORS as any)[lab]}30`}}>
                      <span style={{fontSize:12,fontWeight:700,color:(LAB_COLORS as any)[lab],fontFamily:"monospace"}}>{lab}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:"#040507",border:`1px solid ${C.border}`,borderRadius:8,padding:16,fontFamily:"monospace",fontSize:11.5,color:"#A78BFA",lineHeight:1.7,maxHeight:380,overflowY:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{json}</div>
            </>
          ) : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.textDim,fontSize:13}}>Selecciona un blueprint para exportar</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VALIDATE TAB ────────────────────────────────────────────────────────────
function ValidateTab({ onImport }: any) {
  const [json,   setJson]   = useState("");
  const [result, setResult] = useState<any>(null);
  const validate = () => {
    try {
      const parsed = JSON.parse(json);
      const errors: string[] = []; const warnings: string[] = [];
      if (!parsed.schema_version) errors.push("Falta schema_version");
      else if (!Object.values(SCHEMA).includes(parsed.schema_version)) errors.push(`schema_version no reconocido: ${parsed.schema_version}`);
      if (!parsed.id)          errors.push("Falta campo id");
      if (!parsed.brandId)     errors.push("Falta campo brandId");
      else if (!getBrand(parsed.brandId)) warnings.push(`brandId '${parsed.brandId}' no está en BRANDS registry`);
      if (!parsed.displayName) errors.push("Falta displayName");
      if (!parsed.status)      warnings.push("Falta status — se usará 'draft'");
      if (parsed.schema_version === SCHEMA.PERSON) {
        if (!parsed.imagelab) errors.push("BP_PERSON requiere sección imagelab");
        if (!parsed.voicelab) errors.push("BP_PERSON requiere sección voicelab");
        if (!parsed.compatible_archetypes?.length) warnings.push("compatible_archetypes está vacío");
      }
      if (parsed.schema_version === SCHEMA.LOCATION) {
        if (!parsed.visual)   errors.push("BP_LOCATION requiere sección visual");
        if (!parsed.imagelab) errors.push("BP_LOCATION requiere sección imagelab");
      }
      if (parsed.schema_version === SCHEMA.COPY) {
        if (!parsed.voice) errors.push("BP_COPY requiere sección voice");
        else {
          if (!parsed.voice.tone_primary)  errors.push("voice.tone_primary requerido");
          if (!parsed.voice.writing_style) warnings.push("voice.writing_style no definido");
        }
        if (!parsed.language?.primary) errors.push("language.primary requerido en BP_COPY");
        if (!parsed.channels?.primary?.length) warnings.push("channels.primary está vacío");
      }
      setResult({ valid: errors.length === 0, errors, warnings, parsed, labs: LAB_COMPAT[parsed.schema_version]||[] });
    } catch(e: any) { setResult({ valid: false, parseError: e.message }); }
  };
  const handleImport = () => {
    if (result?.valid && result.parsed) { onImport({ ...result.parsed, status: result.parsed.status || "draft" }); setJson(""); setResult(null); }
  };
  return (
    <div style={{padding:24}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
        <div>
          <div style={{fontSize:11,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:10}}>PEGAR JSON PARA VALIDAR</div>
          <textarea value={json} onChange={(e: any) => setJson(e.target.value)} rows={22}
            placeholder={'{\n  "schema_version": "BP_COPY_1.0",\n  "id": "...",\n  "brandId": "...",\n  ...\n}'}
            style={{width:"100%",boxSizing:"border-box",padding:14,borderRadius:8,background:"#040507",border:`1px solid ${C.border}`,color:"#A78BFA",fontSize:12,fontFamily:"monospace",lineHeight:1.6,outline:"none",resize:"vertical"}}/>
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button onClick={validate} style={{flex:1,padding:"10px 0",borderRadius:7,background:C.accent,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:"0.05em",fontFamily:"inherit"}}>Validar Schema</button>
            <button onClick={() => { setJson(""); setResult(null); }} style={{padding:"10px 16px",borderRadius:7,background:"transparent",color:C.textMuted,border:`1px solid ${C.border}`,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↺ Reset</button>
          </div>
        </div>
        <div>
          <div style={{fontSize:11,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:10}}>RESULTADO</div>
          {!result ? (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:C.textDim,fontSize:13,flexDirection:"column",gap:8}}>
              <div style={{fontSize:32,opacity:0.3}}>◻</div>Pega un blueprint y presiona Validar
            </div>
          ) : result.parseError ? (
            <div style={{padding:16,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,color:C.red,fontSize:12,fontFamily:"monospace"}}>
              <div style={{fontWeight:700,marginBottom:6}}>✗ JSON Parse Error</div>{result.parseError}
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{padding:"14px 18px",borderRadius:9,display:"flex",alignItems:"center",gap:10,background:result.valid?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${result.valid?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`}}>
                <span style={{fontSize:22}}>{result.valid?"✓":"✗"}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:result.valid?C.green:C.red}}>{result.valid?"Blueprint válido":"Blueprint inválido"}</div>
                  {result.valid && result.parsed?.displayName && <div style={{fontSize:11,color:C.textMuted}}>{result.parsed.displayName} · {getSchemaLabel(result.parsed.schema_version)}</div>}
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div style={{padding:12,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:8,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>Errores ({result.errors.length})</div>
                  {result.errors.map((e: string,i: number) => <div key={i} style={{fontSize:12,color:C.red,marginBottom:4,paddingLeft:8,borderLeft:`2px solid ${C.red}40`}}>{e}</div>)}
                </div>
              )}
              {result.warnings?.length > 0 && (
                <div style={{padding:12,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:7}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:8,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>Advertencias ({result.warnings.length})</div>
                  {result.warnings.map((w: string,i: number) => <div key={i} style={{fontSize:12,color:C.amber,marginBottom:4,paddingLeft:8,borderLeft:`2px solid ${C.amber}40`}}>{w}</div>)}
                </div>
              )}
              {result.valid && (
                <>
                  <div style={{padding:12,background:C.panel2,borderRadius:7,border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>Compatible con</div>
                    <LabRoutingBadge schema_version={result.parsed.schema_version}/>
                  </div>
                  <button onClick={handleImport} style={{padding:"12px 0",borderRadius:8,background:`${C.green}20`,border:`1px solid ${C.green}50`,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.05em"}}>✓ Importar al Registry</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function BlueprintLab() {
  const [tab,          setTab]          = useState("registry");
  const [blueprints,   setBlueprintsList] = useState<any[]>(INITIAL_BLUEPRINTS);
  const [editingBp,    setEditingBp]    = useState<any>(null);
  const [exportTarget, setExportTarget] = useState<any>(null);
  const [toast,        setToast]        = useState<any>(null);
  const [dbStatus,     setDbStatus]     = useState<'loading' | 'connected' | 'fallback'>('loading');

  // ── LOAD from Supabase on mount (replaces window.storage.get) ──────────────
  useEffect(() => {
    loadAllBlueprints()
      .then(loaded => {
        if (loaded.length > 0) {
          setBlueprintsList(loaded);
          setDbStatus('connected');
          console.info(`[BlueprintLab] Loaded ${loaded.length} blueprints from Supabase`);
        } else {
          // DB returned 0 results — keep INITIAL_BLUEPRINTS
          setDbStatus('fallback');
        }
      })
      .catch(err => {
        console.warn('[BlueprintLab] Supabase load failed, using initial data:', err.message);
        setDbStatus('fallback');
      });
  }, []);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2800);
  };

  // ── SAVE/UPDATE: upsert to Supabase (replaces window.storage.set) ──────────
  const handleSaveBp = async (bp: any) => {
    try {
      await upsertBlueprint(bp);
      setBlueprintsList(prev => {
        const exists = prev.find((b: any) => b.id === bp.id);
        return exists ? prev.map((b: any) => b.id === bp.id ? bp : b) : [...prev, bp];
      });
      setEditingBp(null);
      setTab("registry");
      showToast(editingBp ? "Blueprint actualizado ✓" : "Blueprint guardado ✓");
    } catch (err: any) {
      showToast(`Error guardando: ${err.message}`, "error");
    }
  };

  // ── CLONE ─────────────────────────────────────────────────────────────────
  const handleClone = async (bp: any) => {
    const cloned = {
      ...bp,
      id: safeId(getSchemaLabel(bp.schema_version).toLowerCase()),
      displayName: bp.displayName + " (copia)",
      status: "draft",
    };
    try {
      await upsertBlueprint(cloned);
      setBlueprintsList(prev => [...prev, cloned]);
      showToast(`Clonado como draft: "${cloned.displayName}"`);
    } catch (err: any) {
      showToast(`Error clonando: ${err.message}`, "error");
    }
  };

  // ── DELETE: delete from Supabase (replaces window.storage.set of filtered array) ──
  const handleDelete = async (bp: any) => {
    if (!confirm("¿Eliminar este blueprint?")) return;
    try {
      await deleteBlueprint(bp);
      setBlueprintsList(prev => prev.filter((b: any) => b.id !== bp.id));
      showToast("Blueprint eliminado", "warning");
    } catch (err: any) {
      showToast(`Error eliminando: ${err.message}`, "error");
    }
  };

  const handleEdit = (bp: any) => { setEditingBp(bp); setTab("builder"); };

  const handleExport    = (bp: any)   => { setExportTarget(bp); setTab("export"); };
  const handleExportAll = (bps: any[]) => {
    downloadJson({ schema: "UNRLVL_BLUEPRINT_REGISTRY_1.0", exported_at: new Date().toISOString(), count: bps.length, blueprints: bps }, "unrlvl-blueprints.json");
    showToast(`${bps.length} blueprints exportados como .json`);
  };

  const handleImportFromValidate = async (bp: any) => {
    try {
      await upsertBlueprint(bp);
      setBlueprintsList(prev => {
        const exists = prev.find((b: any) => b.id === bp.id);
        return exists ? prev.map((b: any) => b.id === bp.id ? bp : b) : [...prev, bp];
      });
      setTab("registry");
      showToast(`"${bp.displayName}" importado al registry ✓`);
    } catch (err: any) {
      showToast(`Error importando: ${err.message}`, "error");
    }
  };

  const navItems = [
    { id: "registry", icon: "◈", label: "Registry" },
    { id: "builder",  icon: "✎", label: "Builder"  },
    { id: "export",   icon: "↓", label: "Export"   },
    { id: "validate", icon: "✓", label: "Validate" },
  ];

  return (
    <div style={{display:"flex",height:"100vh",width:"100vw",background:C.bg,color:C.text,
      fontFamily:"'DM Sans','Helvetica Neue',system-ui,sans-serif",overflow:"hidden"}}>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
        backgroundImage:`radial-gradient(circle,rgba(124,58,237,0.05) 1px,transparent 1px)`,backgroundSize:"28px 28px"}}/>
      <div style={{position:"fixed",top:-100,right:-100,width:400,height:400,
        background:"radial-gradient(circle,rgba(124,58,237,0.07) 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>

      {/* Sidebar */}
      <aside style={{width:64,display:"flex",flexDirection:"column",alignItems:"center",
        padding:"16px 0",borderRight:`1px solid ${C.border}`,background:C.panel,zIndex:10,flexShrink:0}}>
        <div style={{marginBottom:28}}>
          <div style={{width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#7C3AED,#4C1D95)",
            display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
            boxShadow:"0 4px 20px rgba(124,58,237,0.3)"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
          </div>
        </div>
        <nav style={{display:"flex",flexDirection:"column",gap:4,width:"100%",padding:"0 6px"}}>
          {navItems.map(item => {
            const isActive = tab === item.id;
            return (
              <button key={item.id}
                onClick={() => { setTab(item.id); if (item.id === "builder" && tab !== "builder") setEditingBp(null); }}
                title={item.label}
                style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px",borderRadius:8,
                  border:`1px solid ${isActive?C.accent+"40":"transparent"}`,background:isActive?C.accentDim:"transparent",
                  color:isActive?C.accentBright:C.textMuted,cursor:"pointer",gap:3,transition:"all 0.12s",fontFamily:"inherit"}}>
                <span style={{fontSize:16,lineHeight:1}}>{item.icon}</span>
                <span style={{fontSize:8,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{marginTop:"auto",textAlign:"center",paddingBottom:4}}>
          <div style={{fontSize:18,fontWeight:800,color:C.accent,fontFamily:"monospace"}}>{blueprints.length}</div>
          <div style={{fontSize:8,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>BPs</div>
          {/* DB status indicator */}
          <div style={{marginTop:6,width:6,height:6,borderRadius:"50%",margin:"6px auto 0",
            background:dbStatus==='connected'?C.green:dbStatus==='fallback'?C.amber:"rgba(255,255,255,0.2)"}}
            title={dbStatus==='connected'?'Supabase connected':dbStatus==='fallback'?'Using local data':'Connecting...'}/>
        </div>
      </aside>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",zIndex:1}}>
        <header style={{height:52,borderBottom:`1px solid ${C.border}`,display:"flex",
          alignItems:"center",justifyContent:"space-between",padding:"0 24px",
          background:C.panel+"e8",backdropFilter:"blur(12px)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontWeight:800,fontSize:14,letterSpacing:"-0.01em",textTransform:"uppercase",fontStyle:"italic"}}>UNRLVL</span>
              <span style={{color:C.textDim,fontSize:16}}>›</span>
              <span style={{color:C.accentBright,fontWeight:700,fontSize:14}}>BlueprintLab</span>
            </div>
            <span style={{padding:"2px 7px",borderRadius:3,background:C.accentDim,color:C.accent,fontSize:9,fontWeight:700,letterSpacing:"0.12em",fontFamily:"monospace"}}>v1.3</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              {Object.entries({ImageLab:C.yellow,VideoLab:C.blue,VoiceLab:C.voice,CopyLab:C.copy}).map(([name,color]) => (
                <span key={name} style={{fontSize:9,fontWeight:700,color,fontFamily:"monospace",letterSpacing:"0.06em",opacity:0.6}}>{name}</span>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,
              background:dbStatus==='connected'?"rgba(16,185,129,0.1)":"rgba(245,158,11,0.1)",
              border:`1px solid ${dbStatus==='connected'?"rgba(16,185,129,0.2)":"rgba(245,158,11,0.2)"}`}}>
              <div style={{width:5,height:5,borderRadius:"50%",
                background:dbStatus==='connected'?C.green:dbStatus==='loading'?C.textDim:C.amber}}/>
              <span style={{fontSize:10,color:dbStatus==='connected'?C.green:C.amber,fontFamily:"monospace",fontWeight:600}}>
                {dbStatus==='connected'?'SUPABASE':dbStatus==='loading'?'LOADING...':'LOCAL'}
              </span>
            </div>
          </div>
        </header>

        <main style={{flex:1,overflow:"hidden"}}>
          {tab === "registry" && (
            <RegistryTab blueprints={blueprints} onEdit={handleEdit} onDelete={handleDelete}
              onClone={handleClone} onExport={handleExport} onExportAll={handleExportAll}/>
          )}
          {tab === "builder" && (
            <BuilderTab onSave={handleSaveBp} editingBp={editingBp}
              onCancelEdit={() => { setEditingBp(null); setTab("registry"); }}/>
          )}
          {tab === "export" && (
            <ExportTab blueprints={blueprints} initialSelected={exportTarget?.id}/>
          )}
          {tab === "validate" && <ValidateTab onImport={handleImportFromValidate}/>}
        </main>
      </div>

      {toast && (
        <div style={{position:"fixed",bottom:24,right:24,padding:"12px 20px",borderRadius:8,zIndex:1000,
          background:toast.type==="warning"?"rgba(245,158,11,0.15)":toast.type==="error"?"rgba(239,68,68,0.15)":"rgba(16,185,129,0.15)",
          border:`1px solid ${toast.type==="warning"?C.amber:toast.type==="error"?C.red:C.green}40`,
          color:toast.type==="warning"?C.amber:toast.type==="error"?C.red:C.green,
          fontSize:13,fontWeight:600,backdropFilter:"blur(8px)",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
          {toast.msg}
        </div>
      )}

      <style>{`
        *::-webkit-scrollbar{width:6px;height:6px}
        *::-webkit-scrollbar-track{background:transparent}
        *::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.3);border-radius:3px}
        *::-webkit-scrollbar-thumb:hover{background:rgba(124,58,237,0.5)}
        select option{background:#111318;color:#E8E8F0}
      `}</style>
    </div>
  );
}
