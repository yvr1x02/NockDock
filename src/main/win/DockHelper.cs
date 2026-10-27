// Aiutante di Windows per il dock: volume per app, uscita audio, luminosità dei monitor, tasti multimediali
// e ritorno del puntatore dopo un tocco.
// Gira dentro un processo PowerShell sempre acceso (Add-Type) e risponde a una richiesta per riga:
//   richiesta: id <TAB> comando <TAB> argomenti...
//   risposta:  id <TAB> json
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

namespace DockWin
{
    // ---------- Core Audio (COM) ----------
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorCom { }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int Item(int index, out IMMDevice device);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
        [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore store);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out int state);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey { public Guid fmtid; public int pid; }

    // PROPVARIANT: 16 byte a 32 bit, 24 a 64 bit; ci basta il tipo e il puntatore alla stringa
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    struct PropVariant
    {
        [FieldOffset(0)] public short vt;
        [FieldOffset(8)] public IntPtr pointer;
    }

    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int GetAt(int prop, out PropertyKey key);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
        [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant value);
        [PreserveSig] int Commit();
    }

    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume
    {
        [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
        [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
        [PreserveSig] int GetChannelCount(out int count);
        [PreserveSig] int SetMasterVolumeLevel(float levelDb, ref Guid context);
        [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid context);
        [PreserveSig] int GetMasterVolumeLevel(out float levelDb);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
        [PreserveSig] int SetChannelVolumeLevel(int channel, float levelDb, ref Guid context);
        [PreserveSig] int SetChannelVolumeLevelScalar(int channel, float level, ref Guid context);
        [PreserveSig] int GetChannelVolumeLevel(int channel, out float levelDb);
        [PreserveSig] int GetChannelVolumeLevelScalar(int channel, out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2
    {
        [PreserveSig] int GetAudioSessionControl(IntPtr sessionGuid, int flags, out IntPtr control);
        [PreserveSig] int GetSimpleAudioVolume(IntPtr sessionGuid, int flags, out IntPtr volume);
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
        [PreserveSig] int RegisterSessionNotification(IntPtr notify);
        [PreserveSig] int UnregisterSessionNotification(IntPtr notify);
        [PreserveSig] int RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string sessionId, IntPtr notify);
        [PreserveSig] int UnregisterDuckNotification(IntPtr notify);
    }

    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int GetSession(int index, out IAudioSessionControl2 session);
    }

    [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2
    {
        // IAudioSessionControl
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid context);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid context);
        [PreserveSig] int GetGroupingParam(out Guid grouping);
        [PreserveSig] int SetGroupingParam(ref Guid grouping, ref Guid context);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr notify);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr notify);
        // IAudioSessionControl2
        [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetProcessId(out int pid);
        [PreserveSig] int IsSystemSoundsSession();
        [PreserveSig] int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
    }

    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISimpleAudioVolume
    {
        [PreserveSig] int SetMasterVolume(float level, ref Guid context);
        [PreserveSig] int GetMasterVolume(out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    // Interfaccia non documentata ma stabile da Windows 7: è quella che usa il pannello Audio per cambiare uscita
    [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
    class PolicyConfigClient { }

    [Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPolicyConfig
    {
        [PreserveSig] int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr format);
        [PreserveSig] int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id, int isDefault, IntPtr format);
        [PreserveSig] int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id);
        [PreserveSig] int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr endpointFormat, IntPtr mixFormat);
        [PreserveSig] int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string id, int isDefault, IntPtr defaultPeriod, IntPtr minPeriod);
        [PreserveSig] int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr period);
        [PreserveSig] int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr mode);
        [PreserveSig] int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr mode);
        [PreserveSig] int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr key, IntPtr value);
        [PreserveSig] int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr key, IntPtr value);
        [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
        [PreserveSig] int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string id, int visible);
    }

    // ---------- Monitor (DDC/CI) e tastiera ----------
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct PhysicalMonitor
    {
        public IntPtr handle;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string description;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct Rect { public int left, top, right, bottom; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct MonitorInfoEx
    {
        public int size;
        public Rect monitor;
        public Rect work;
        public int flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string device;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct CursorPoint { public int x, y; }

    static class Native
    {
        public delegate bool MonitorEnumProc(IntPtr monitor, IntPtr hdc, IntPtr rect, IntPtr data);
        [DllImport("user32.dll")] public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc proc, IntPtr data);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfoEx info);
        [DllImport("dxva2.dll")] public static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr monitor, out int count);
        [DllImport("dxva2.dll")] public static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr monitor, int count, [Out] PhysicalMonitor[] monitors);
        [DllImport("dxva2.dll")] public static extern bool DestroyPhysicalMonitors(int count, PhysicalMonitor[] monitors);
        [DllImport("dxva2.dll")] public static extern bool GetMonitorBrightness(IntPtr monitor, out int min, out int current, out int max);
        [DllImport("dxva2.dll")] public static extern bool SetMonitorBrightness(IntPtr monitor, int value);
        [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, int flags, IntPtr extra);
        [DllImport("ole32.dll")] public static extern int PropVariantClear(ref PropVariant pv);
        [DllImport("user32.dll")] public static extern bool GetCursorPos(out CursorPoint p);
        [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    }

    // ---------- Piccolo scrittore JSON ----------
    class Json
    {
        readonly StringBuilder sb = new StringBuilder();
        bool first = true;
        public static string Q(string s)
        {
            if (s == null) return "null";
            var b = new StringBuilder("\"");
            foreach (char c in s)
            {
                if (c == '"' || c == '\\') b.Append('\\').Append(c);
                else if (c < 32) b.Append("\\u").Append(((int)c).ToString("x4"));
                else b.Append(c);
            }
            return b.Append('"').ToString();
        }
        public Json Open(char c) { Sep(); sb.Append(c); first = true; return this; }
        public Json Close(char c) { sb.Append(c); first = false; return this; }
        void Sep() { if (!first) sb.Append(','); first = false; }
        public Json Key(string k) { Sep(); sb.Append(Q(k)).Append(':'); first = true; return this; }
        public Json Str(string v) { Sep(); sb.Append(Q(v)); return this; }
        public Json Num(double v) { Sep(); sb.Append(v.ToString(CultureInfo.InvariantCulture)); return this; }
        public Json Bool(bool v) { Sep(); sb.Append(v ? "true" : "false"); return this; }
        public override string ToString() { return sb.ToString(); }
    }

    public static class Helper
    {
        const int eRender = 0, DEVICE_STATE_ACTIVE = 1, CLSCTX_ALL = 23;
        static Guid ctx = Guid.Empty;
        static readonly Dictionary<int, string[]> procCache = new Dictionary<int, string[]>();

        static IMMDeviceEnumerator Enumerator() { return (IMMDeviceEnumerator)new MMDeviceEnumeratorCom(); }

        static IMMDevice DefaultDevice()
        {
            IMMDevice dev;
            Check(Enumerator().GetDefaultAudioEndpoint(eRender, 1, out dev));
            return dev;
        }

        static void Check(int hr) { if (hr != 0) Marshal.ThrowExceptionForHR(hr); }

        static T Activate<T>(IMMDevice dev)
        {
            Guid iid = typeof(T).GUID;
            object o;
            Check(dev.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o));
            return (T)o;
        }

        static string FriendlyName(IMMDevice dev)
        {
            IPropertyStore store;
            if (dev.OpenPropertyStore(0, out store) != 0) return "Dispositivo audio";
            var key = new PropertyKey { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };
            PropVariant v;
            if (store.GetValue(ref key, out v) != 0) return "Dispositivo audio";
            string name = v.vt == 31 ? Marshal.PtrToStringUni(v.pointer) : "Dispositivo audio";
            Native.PropVariantClear(ref v);
            return name;
        }

        /// [chiave, nome] del processo: la chiave è il nome dell'eseguibile, il nome quello leggibile
        static string[] ProcessInfo(int pid)
        {
            string[] info;
            if (procCache.TryGetValue(pid, out info)) return info;
            string key = "pid" + pid, name = key;
            try
            {
                var p = Process.GetProcessById(pid);
                key = p.ProcessName.ToLowerInvariant();
                name = p.ProcessName;
                try
                {
                    string desc = p.MainModule.FileVersionInfo.FileDescription;
                    if (!string.IsNullOrWhiteSpace(desc)) name = desc.Trim();
                }
                catch { }
            }
            catch { }
            info = new[] { key, name };
            procCache[pid] = info;
            return info;
        }

        class AppGroup { public string key, name; public float volume; public bool muted = true; public List<ISimpleAudioVolume> volumes = new List<ISimpleAudioVolume>(); }

        static List<AppGroup> Sessions()
        {
            var mgr = Activate<IAudioSessionManager2>(DefaultDevice());
            IAudioSessionEnumerator list;
            Check(mgr.GetSessionEnumerator(out list));
            int n;
            list.GetCount(out n);
            var groups = new Dictionary<string, AppGroup>();
            var order = new List<AppGroup>();
            for (int i = 0; i < n; i++)
            {
                IAudioSessionControl2 s;
                if (list.GetSession(i, out s) != 0 || s == null) continue;
                int state;
                s.GetState(out state);
                if (state == 2) continue; // sessione scaduta
                string key, name;
                if (s.IsSystemSoundsSession() == 0) { key = "system"; name = "Suoni di sistema"; }
                else
                {
                    int pid;
                    s.GetProcessId(out pid);
                    var info = ProcessInfo(pid);
                    key = info[0];
                    name = info[1];
                }
                var vol = (ISimpleAudioVolume)s;
                AppGroup g;
                if (!groups.TryGetValue(key, out g))
                {
                    g = new AppGroup { key = key, name = name };
                    vol.GetMasterVolume(out g.volume);
                    groups[key] = g;
                    order.Add(g);
                }
                bool m;
                vol.GetMute(out m);
                g.muted = g.muted && m;
                g.volumes.Add(vol);
            }
            return order;
        }

        static string Audio()
        {
            var dev = DefaultDevice();
            string defaultId;
            dev.GetId(out defaultId);
            var ep = Activate<IAudioEndpointVolume>(dev);
            float master;
            bool masterMuted;
            ep.GetMasterVolumeLevelScalar(out master);
            ep.GetMute(out masterMuted);

            var j = new Json().Open('{');
            j.Key("ok").Bool(true);
            j.Key("master").Open('{').Key("volume").Num(Math.Round(master * 100)).Key("muted").Bool(masterMuted).Close('}');

            j.Key("devices").Open('[');
            IMMDeviceCollection all;
            Check(Enumerator().EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, out all));
            int count;
            all.GetCount(out count);
            for (int i = 0; i < count; i++)
            {
                IMMDevice d;
                all.Item(i, out d);
                string id;
                d.GetId(out id);
                j.Open('{').Key("id").Str(id).Key("name").Str(FriendlyName(d)).Key("isDefault").Bool(id == defaultId).Close('}');
            }
            j.Close(']');

            j.Key("apps").Open('[');
            foreach (var g in Sessions())
                j.Open('{').Key("key").Str(g.key).Key("name").Str(g.name).Key("volume").Num(Math.Round(g.volume * 100)).Key("muted").Bool(g.muted).Close('}');
            j.Close(']');
            return j.Close('}').ToString();
        }

        static string Ok() { return "{\"ok\":true}"; }

        static float Level(string v) { return Math.Max(0, Math.Min(100, float.Parse(v, CultureInfo.InvariantCulture))) / 100f; }

        static string SetApp(string key, string what, string value)
        {
            foreach (var g in Sessions())
            {
                if (g.key != key) continue;
                foreach (var v in g.volumes)
                {
                    if (what == "volume") v.SetMasterVolume(Level(value), ref ctx);
                    else v.SetMute(value == "1", ref ctx);
                }
                return Ok();
            }
            return "{\"ok\":false,\"error\":\"App non trovata nel mixer\"}";
        }

        static string SetMaster(string what, string value)
        {
            var ep = Activate<IAudioEndpointVolume>(DefaultDevice());
            if (what == "volume") Check(ep.SetMasterVolumeLevelScalar(Level(value), ref ctx));
            else Check(ep.SetMute(value == "1", ref ctx));
            return Ok();
        }

        static string SetOutput(string id)
        {
            var policy = (IPolicyConfig)new PolicyConfigClient();
            for (int role = 0; role < 3; role++) Check(policy.SetDefaultEndpoint(id, role));
            return Ok();
        }

        /// Esegue fn per ogni monitor fisico; i monitor si contano nell'ordine di Windows (id "0", "1", ...)
        static void ForEachMonitor(Action<string, string, IntPtr> fn)
        {
            var handles = new List<IntPtr>();
            Native.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (m, h, r, d) => { handles.Add(m); return true; }, IntPtr.Zero);
            int index = 0;
            foreach (var hmon in handles)
            {
                var info = new MonitorInfoEx { size = Marshal.SizeOf(typeof(MonitorInfoEx)) };
                Native.GetMonitorInfo(hmon, ref info);
                string res = (info.monitor.right - info.monitor.left) + "×" + (info.monitor.bottom - info.monitor.top);
                int n;
                if (!Native.GetNumberOfPhysicalMonitorsFromHMONITOR(hmon, out n) || n == 0) { index++; continue; }
                var arr = new PhysicalMonitor[n];
                if (!Native.GetPhysicalMonitorsFromHMONITOR(hmon, n, arr)) { index++; continue; }
                try
                {
                    foreach (var pm in arr)
                    {
                        string label = "Monitor " + (index + 1) + " · " + res;
                        fn(index.ToString(CultureInfo.InvariantCulture), label, pm.handle);
                        index++;
                    }
                }
                finally { Native.DestroyPhysicalMonitors(n, arr); }
            }
        }

        static string Monitors()
        {
            var j = new Json().Open('{').Key("ok").Bool(true).Key("monitors").Open('[');
            ForEachMonitor((id, label, h) =>
            {
                int min, cur, max;
                bool ok = Native.GetMonitorBrightness(h, out min, out cur, out max) && max > min;
                double pct = ok ? Math.Round(100.0 * (cur - min) / (max - min)) : 0;
                j.Open('{').Key("id").Str(id).Key("name").Str(label).Key("ok").Bool(ok).Key("brightness").Num(pct).Close('}');
            });
            return j.Close(']').Close('}').ToString();
        }

        static string Brightness(string id, string value)
        {
            bool done = false;
            ForEachMonitor((mid, label, h) =>
            {
                if (mid != id) return;
                int min, cur, max;
                if (!Native.GetMonitorBrightness(h, out min, out cur, out max)) return;
                int v = (int)Math.Round(min + (max - min) * Level(value));
                done = Native.SetMonitorBrightness(h, v);
            });
            return done ? Ok() : "{\"ok\":false,\"error\":\"Il monitor non accetta comandi DDC/CI\"}";
        }

        static string Media(string cmd)
        {
            byte vk = cmd == "next" ? (byte)0xB0 : cmd == "prev" ? (byte)0xB1 : (byte)0xB3;
            Native.keybd_event(vk, 0, 0, IntPtr.Zero);
            Native.keybd_event(vk, 0, 2, IntPtr.Zero);
            return Ok();
        }

        // ---- Puntatore: dopo un tocco sul dock torna dove l'aveva lasciato il mouse

        static readonly object cursorLock = new object();
        static int dockLeft, dockTop, dockRight, dockBottom;
        static bool hasCursor, tracking;
        static int lastX, lastY;

        /// Coordinate in pixel reali su tutti i monitor, qualunque sia il ridimensionamento di Windows
        static void DpiAware()
        {
            try { Native.SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch (Exception) { }
        }

        static string CursorTrack(string l, string t, string r, string b)
        {
            lock (cursorLock)
            {
                dockLeft = int.Parse(l, CultureInfo.InvariantCulture);
                dockTop = int.Parse(t, CultureInfo.InvariantCulture);
                dockRight = int.Parse(r, CultureInfo.InvariantCulture);
                dockBottom = int.Parse(b, CultureInfo.InvariantCulture);
            }
            if (tracking) return Ok();
            tracking = true;
            var thread = new System.Threading.Thread(() =>
            {
                DpiAware();
                while (true)
                {
                    CursorPoint p;
                    if (Native.GetCursorPos(out p))
                    {
                        lock (cursorLock)
                        {
                            bool onDock = p.x >= dockLeft && p.x < dockRight && p.y >= dockTop && p.y < dockBottom;
                            if (!onDock) { lastX = p.x; lastY = p.y; hasCursor = true; }
                        }
                    }
                    System.Threading.Thread.Sleep(40);
                }
            });
            thread.IsBackground = true;
            thread.Start();
            return Ok();
        }

        static string CursorRestore()
        {
            int x, y;
            lock (cursorLock)
            {
                if (!hasCursor) return Ok();
                x = lastX; y = lastY;
            }
            DpiAware();
            Native.SetCursorPos(x, y);
            return Ok();
        }

        public static string Run(string[] p)
        {
            string cmd = p.Length > 1 ? p[1] : "";
            switch (cmd)
            {
                case "ping": return Ok();
                case "audio": return Audio();
                case "appvol": return SetApp(p[2], "volume", p[3]);
                case "appmute": return SetApp(p[2], "mute", p[3]);
                case "mastervol": return SetMaster("volume", p[2]);
                case "mastermute": return SetMaster("mute", p[2]);
                case "output": return SetOutput(p[2]);
                case "monitors": return Monitors();
                case "bright": return Brightness(p[2], p[3]);
                case "media": return Media(p[2]);
                case "cursortrack": return CursorTrack(p[2], p[3], p[4], p[5]);
                case "cursorrestore": return CursorRestore();
                default: return "{\"ok\":false,\"error\":\"Comando sconosciuto\"}";
            }
        }

        /// Ciclo principale: una richiesta per riga su stdin, una risposta per riga su stdout
        public static void Serve()
        {
            var stdin = Console.In;
            var stdout = new System.IO.StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
            stdout.AutoFlush = true;
            stdout.WriteLine("ready\t{\"ok\":true}");
            string line;
            while ((line = stdin.ReadLine()) != null)
            {
                var parts = line.Split('\t');
                string result;
                try { result = Run(parts); }
                catch (Exception e) { result = "{\"ok\":false,\"error\":" + Json.Q(e.Message) + "}"; }
                stdout.WriteLine(parts[0] + "\t" + result);
            }
        }
    }
}
