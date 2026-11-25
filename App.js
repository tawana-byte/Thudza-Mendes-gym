import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet, useColorScheme, Linking, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const KEY = "gym-v2";
const SERIF = Platform.select({ ios: "Georgia", default: "serif" });
const LIGHT = { bg: "#f5f2ec", card: "#fffefb", text: "#1d1b18", mute: "#7b746a", line: "#e5dfd3", gold: "#86672a", pri: "#1d1b18", on: "#f7f3ea", ok: "#3d7a58", okT: "#e3efe7", warn: "#9c6a1f", warnT: "#f6ecd6", bad: "#a23b3b", badT: "#f5e1de" };
const DARK = { bg: "#11100e", card: "#1a1815", text: "#f2ede4", mute: "#a0978a", line: "#2d2a25", gold: "#d6b46e", pri: "#d6b46e", on: "#1a1408", ok: "#6fc196", okT: "#14291f", warn: "#e3b765", warnT: "#332712", bad: "#ef8a84", badT: "#381d1b" };
const DEF = { plans: [{ id: "p1", name: "Monthly Basic", days: "30", price: "10" }, { id: "p2", name: "Monthly Plus", days: "30", price: "15" }], members: [], payments: [] };

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const dt = (s) => new Date(s + "T00:00:00");
const addDays = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((dt(a) - dt(b)) / 864e5);
const fd = (s) => dt(s).toDateString().slice(4);
const money = (n) => "$" + (Math.round(n * 100) / 100).toLocaleString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v) => parseFloat(String(v || "").replace(",", ".")) || 0;
const days = (p) => Math.max(1, parseInt(p.days) || 30);
const status = (m) => { const d = diff(m.expiry, today()); return [d < 0 ? "expired" : d <= 7 ? "soon" : "active", d]; };
const label = ([k, d]) => (k === "expired" ? `Expired ${-d} day${d === -1 ? "" : "s"} ago` : d === 0 ? "Expires today" : `${d} day${d === 1 ? "" : "s"} left`);

export default function App() {
  return <SafeAreaProvider><Gym /></SafeAreaProvider>;
}

function Gym() {
  const dark = useColorScheme() === "dark";
  const t = dark ? DARK : LIGHT;
  const [S, setS] = useState(DEF);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("home");
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", planId: "p1", start: today(), paid: "10" });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [pick, setPick] = useState({});

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setS((s) => ({ ...s, ...JSON.parse(v) })); }).catch(() => {}).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(S)).catch(() => {}); }, [S, ready]);

  const T = today();
  const plan = (id) => S.plans.find((p) => p.id === id) || S.plans[0] || { id: "", name: "Plan", days: "30", price: "0" };
  const ws = S.members.map((m) => ({ m, s: status(m) }));
  const exp = ws.filter((x) => x.s[0] === "expired");
  const soon = ws.filter((x) => x.s[0] === "soon");
  const rev = S.payments.filter((p) => p.date.startsWith(T.slice(0, 7))).reduce((a, p) => a + p.amt, 0);
  const ql = q.toLowerCase();
  const list = ws.filter(({ m, s }) => (filter === "all" || s[0] === filter) && (m.name.toLowerCase().includes(ql) || (m.phone || "").includes(q)));

  const addMember = () => {
    const name = f.name.trim();
    if (!name) { Alert.alert("Enter the member’s name"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.start) || isNaN(dt(f.start))) { Alert.alert("Start date", "Use the format YYYY-MM-DD."); return; }
    const p = plan(f.planId), paid = num(f.paid);
    const m = { id: uid(), name, phone: f.phone.trim(), planId: p.id, start: f.start, expiry: addDays(f.start, days(p)) };
    setS((s) => ({ ...s, members: [m, ...s.members], payments: paid > 0 ? [{ id: uid(), mid: m.id, name, plan: p.name, amt: paid, date: T }, ...s.payments] : s.payments }));
    setF({ name: "", phone: "", planId: p.id, start: T, paid: p.price });
    setShowForm(false);
    Alert.alert("Member added", `${name}’s membership ends ${fd(m.expiry)}.`);
  };
  const renew = (id) => {
    const m = S.members.find((x) => x.id === id);
    if (!m) return;
    const p = plan(pick[id] || m.planId), base = diff(m.expiry, T) > 0 ? m.expiry : T, e2 = addDays(base, days(p)), amt = num(p.price);
    setS((s) => ({ ...s, members: s.members.map((x) => (x.id === id ? { ...x, planId: p.id, expiry: e2 } : x)), payments: [{ id: uid(), mid: id, name: m.name, plan: p.name, amt, date: T }, ...s.payments] }));
    Alert.alert("Renewed", `${m.name} is active until ${fd(e2)}. ${money(amt)} recorded.`);
  };
  const delMember = (m) => Alert.alert("Delete member?", m.name, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => setS((s) => ({ ...s, members: s.members.filter((x) => x.id !== m.id) })) }]);
  const setPlan = (id, k, v) => setS((s) => ({ ...s, plans: s.plans.map((p) => (p.id === id ? { ...p, [k]: v } : p)) }));
  const delPlan = (id) => {
    if (S.members.some((m) => m.planId === id)) { Alert.alert("Plan in use", "Some members use this plan."); return; }
    if (S.plans.length < 2) { Alert.alert("Keep at least one plan"); return; }
    setS((s) => ({ ...s, plans: s.plans.filter((p) => p.id !== id) }));
  };

  const card = [st.card, { backgroundColor: t.card, borderColor: t.line }];
  const input = [st.input, { backgroundColor: t.card, borderColor: t.line, color: t.text }];
  const col = { active: [t.ok, t.okT], soon: [t.warn, t.warnT], expired: [t.bad, t.badT] };
  const btn = (key, text, onPress, primary) => (
    <Pressable key={key} onPress={onPress} style={[st.btn, { backgroundColor: primary ? t.pri : "transparent", borderColor: primary ? t.pri : t.line }]}>
      <Text style={{ color: primary ? t.on : t.text, fontWeight: "600", fontSize: 13, letterSpacing: 0.3 }}>{text}</Text>
    </Pressable>
  );
  const call = (m) => (m.phone ? btn("c", "Call", () => Linking.openURL("tel:" + m.phone)) : null);
  const stat = (l, v, c, wide) => (
    <View key={l} style={[st.stat, { backgroundColor: t.card, borderColor: t.line }, wide && { width: "100%" }]}>
      <Text style={{ color: t.mute, fontSize: 10.5, letterSpacing: 1.4, fontWeight: "700" }}>{l.toUpperCase()}</Text>
      <Text style={{ color: c || t.text, fontSize: 32, fontFamily: SERIF, fontWeight: "600" }}>{v}</Text>
    </View>
  );
  const h2 = (text, c) => <Text style={{ color: c || t.gold, fontSize: 11.5, fontWeight: "700", letterSpacing: 2, marginTop: 20, marginBottom: 10 }}>{text.toUpperCase()}</Text>;
  const rule = <View style={{ width: 34, height: 2, backgroundColor: t.gold, marginTop: 10, marginBottom: 18 }} />;
  const alertRows = (arr) => arr.map(({ m, s }) => (
    <View key={m.id} style={[st.row, { paddingVertical: 9, borderTopWidth: 1, borderTopColor: t.line }]}>
      <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: "600" }}>{m.name}</Text><Text style={{ color: t.mute, fontSize: 13 }}>{label(s)}</Text></View>
      <View style={{ flexDirection: "row", gap: 6 }}>{call(m)}{btn("r", "Renew", () => renew(m.id), true)}</View>
    </View>
  ));

  const home = () => (
    <View>
      <Text style={{ color: t.gold, fontSize: 11.5, fontWeight: "700", letterSpacing: 2, marginTop: 4 }}>GYM MANAGER</Text>
      <Text style={{ color: t.text, fontSize: 27, fontFamily: SERIF, fontWeight: "600", letterSpacing: 2.5, marginTop: 6, textTransform: "uppercase", lineHeight: 34 }}>Thudza Mendes Fitness</Text>
      {rule}
      <View style={st.grid}>
        {stat("Members", S.members.length)}
        {stat("Active", S.members.length - exp.length, t.ok)}
        {stat("Expiring in 7 days", soon.length, t.warn)}
        {stat("Expired", exp.length, t.bad)}
        {stat("Income this month", money(rev), null, true)}
      </View>
      {S.members.length === 0 && <Text style={{ color: t.mute, marginTop: 12, fontStyle: "italic" }}>No members yet. Go to Members and add your first one.</Text>}
      {exp.length > 0 && <View>{h2("Expired memberships", t.bad)}<View style={card}>{alertRows(exp)}</View></View>}
      {soon.length > 0 && <View>{h2("Expiring soon", t.warn)}<View style={card}>{alertRows(soon)}</View></View>}
      {S.members.length > 0 && !exp.length && !soon.length && <View style={[st.alert, { backgroundColor: t.okT }]}><Text style={{ color: t.ok, fontWeight: "600" }}>All memberships are up to date.</Text></View>}
      {S.payments.length > 0 && (
        <View>{h2("Recent payments")}
          <View style={card}>
            {S.payments.slice(0, 5).map((p) => (
              <View key={p.id} style={[st.row, { paddingVertical: 6 }]}><Text style={{ color: t.text, flex: 1 }}>{p.name} · {p.plan}</Text><Text style={{ color: t.text, fontWeight: "700" }}>{money(p.amt)}</Text></View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const members = () => (
    <View>
      <View style={st.row}>
        <Text style={[st.h1, { color: t.text }]}>Members</Text>
        {btn("add", showForm ? "Cancel" : "+ Add member", () => setShowForm(!showForm), !showForm)}
      </View>
      {rule}
      {showForm && (
        <View style={card}>
          <TextInput style={input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Full name" placeholderTextColor={t.mute} />
          <TextInput style={[...input, { marginTop: 10 }]} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={t.mute} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
            {S.plans.map((p) => (
              <Pressable key={p.id} onPress={() => setF({ ...f, planId: p.id, paid: p.price })} style={[st.chip, { borderColor: f.planId === p.id ? t.pri : t.line, backgroundColor: f.planId === p.id ? t.pri : "transparent" }]}>
                <Text style={{ color: f.planId === p.id ? t.on : t.text, fontWeight: "500" }}>{p.name} ({money(num(p.price))})</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput style={input} value={f.start} onChangeText={(v) => setF({ ...f, start: v })} placeholder="Start date YYYY-MM-DD" placeholderTextColor={t.mute} />
          <TextInput style={[...input, { marginTop: 10 }]} value={String(f.paid)} onChangeText={(v) => setF({ ...f, paid: v })} keyboardType="decimal-pad" placeholder="Amount paid (USD)" placeholderTextColor={t.mute} />
          <Pressable onPress={addMember} style={[st.save, { backgroundColor: t.pri }]}><Text style={{ color: t.on, fontWeight: "600", letterSpacing: 0.3 }}>Save member</Text></Pressable>
        </View>
      )}
      <TextInput style={input} value={q} onChangeText={setQ} placeholder="Search name or phone" placeholderTextColor={t.mute} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
        {[["all", "All"], ["active", "Active"], ["soon", "Expiring"], ["expired", "Expired"]].map(([k, l]) => (
          <Pressable key={k} onPress={() => setFilter(k)} style={[st.chip, { borderColor: filter === k ? t.pri : t.line, backgroundColor: filter === k ? t.pri : "transparent" }]}>
            <Text style={{ color: filter === k ? t.on : t.mute, fontWeight: "500" }}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {list.length === 0 && <Text style={{ color: t.mute, fontStyle: "italic" }}>{S.members.length ? "No members match." : "No members yet. Tap + Add member."}</Text>}
      {list.map(({ m, s }) => (
        <View key={m.id} style={card}>
          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "600", fontSize: 19, fontFamily: SERIF }}>{m.name}</Text>
              <Text style={{ color: t.mute, fontSize: 13 }}>{m.phone || "No phone"} · ends {fd(m.expiry)}</Text>
            </View>
            <View style={[st.badge, { backgroundColor: col[s[0]][1] }]}><Text style={{ color: col[s[0]][0], fontWeight: "700", fontSize: 11, letterSpacing: 0.6 }}>{(s[0] === "active" ? label(s) : s[0] === "soon" ? "Expiring" : "Expired").toUpperCase()}</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {S.plans.map((p) => {
              const on = (pick[m.id] || m.planId) === p.id;
              return (
                <Pressable key={p.id} onPress={() => setPick({ ...pick, [m.id]: p.id })} style={[st.chip, { borderColor: on ? t.pri : t.line, backgroundColor: on ? t.pri : "transparent" }]}>
                  <Text style={{ color: on ? t.on : t.text, fontSize: 13, fontWeight: "500" }}>{p.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {btn("r", "Renew", () => renew(m.id), true)}{call(m)}{btn("d", "Delete", () => delMember(m))}
          </View>
        </View>
      ))}
    </View>
  );

  const plans = () => (
    <View>
      <Text style={[st.h1, { color: t.text }]}>Plans (USD)</Text>
      {rule}
      {S.plans.map((p) => (
        <View key={p.id} style={card}>
          <TextInput style={input} value={p.name} onChangeText={(v) => setPlan(p.id, "name", v)} placeholder="Plan name" placeholderTextColor={t.mute} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}><Text style={{ color: t.mute, fontSize: 12 }}>Days</Text><TextInput style={input} value={String(p.days)} onChangeText={(v) => setPlan(p.id, "days", v)} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Text style={{ color: t.mute, fontSize: 12 }}>Price ($)</Text><TextInput style={input} value={String(p.price)} onChangeText={(v) => setPlan(p.id, "price", v)} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: "row", marginTop: 10 }}>{btn("d", "Delete plan", () => delPlan(p.id))}</View>
        </View>
      ))}
      <Pressable onPress={() => setS((s) => ({ ...s, plans: [...s.plans, { id: uid(), name: "New plan", days: "30", price: "0" }] }))} style={[st.save, { backgroundColor: t.pri }]}><Text style={{ color: t.on, fontWeight: "600", letterSpacing: 0.3 }}>+ Add plan</Text></Pressable>
    </View>
  );

  const tabs = [["home", "Home"], ["members", "Members"], ["plans", "Plans"]];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          {tab === "home" && home()}{tab === "members" && members()}{tab === "plans" && plans()}
        </ScrollView>
        <View style={[st.nav, { backgroundColor: t.card, borderTopColor: t.line }]}>
          {tabs.map(([k, l]) => (
            <Pressable key={k} onPress={() => { setTab(k); setShowForm(false); }} style={st.tab}>
              {tab === k && <View style={[st.tabLine, { backgroundColor: t.gold }]} />}
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.5, color: tab === k ? t.gold : t.mute }}>{l.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 32, fontFamily: SERIF, fontWeight: "600", marginVertical: 6 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 15, paddingVertical: 7, marginRight: 8 },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  save: { borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  stat: { width: "48%", flexGrow: 1, borderWidth: 1, borderRadius: 10, padding: 14 },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  alert: { borderRadius: 10, padding: 13, marginVertical: 10 },
  nav: { flexDirection: "row", borderTopWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabLine: { position: "absolute", top: 0, left: "30%", right: "30%", height: 2 },
});
