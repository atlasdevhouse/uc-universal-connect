using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Management;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

class UCAgent {
    static string SERVER = "https://uc-universal-connect-omega.vercel.app";
    static string DEVICE_ID;
    static string OS_NAME = "Windows";
    static string LOCAL_IP = "unknown";
    static string PUBLIC_IP = "unknown";
    
    [DllImport("user32.dll")] static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    const uint MOUSEEVENTF_LEFTDOWN = 0x02, MOUSEEVENTF_LEFTUP = 0x04;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x08, MOUSEEVENTF_RIGHTUP = 0x10;
    
    static void Main() {
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
        Console.WriteLine("UC Agent v2.4 starting...");
        try {
            var searcher = new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct");
            string uuid = "unknown";
            foreach (ManagementObject mo in searcher.Get()) { uuid = mo["UUID"].ToString(); break; }
            DEVICE_ID = Environment.MachineName + "-" + uuid;
        } catch { DEVICE_ID = Environment.MachineName; }
        try {
            var os = new ManagementObjectSearcher("SELECT Caption FROM Win32_OperatingSystem");
            foreach (ManagementObject mo in os.Get()) { OS_NAME = mo["Caption"].ToString().Trim(); break; }
        } catch { }
        try {
            using (var sock = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp)) {
                sock.Connect("8.8.8.8", 53);
                LOCAL_IP = ((IPEndPoint)sock.LocalEndPoint).Address.ToString();
            }
        } catch { }
        try {
            var req = (HttpWebRequest)WebRequest.Create("https://api.ipify.org");
            req.Timeout = 5000;
            using (var res = req.GetResponse())
            using (var sr = new StreamReader(res.GetResponseStream()))
                PUBLIC_IP = sr.ReadToEnd().Trim();
        } catch { }
        
        Console.WriteLine("Device: " + DEVICE_ID);
        Console.WriteLine("OS: " + OS_NAME);
        Console.WriteLine("IP: " + LOCAL_IP + " / " + PUBLIC_IP);
        
        int n = 0;
        while (true) {
            try {
                if (n % 10 == 0) SendHeartbeat();
                SendScreenshot();
                PollCommands();
            } catch (Exception ex) { Console.WriteLine("ERR: " + ex.Message); }
            n++;
            Thread.Sleep(3000);
        }
    }
    
    static void SendHeartbeat() {
        string json = "{\"deviceId\":\"" + DEVICE_ID + "\",\"name\":\"" + Environment.MachineName + 
            "\",\"os\":\"" + OS_NAME + "\",\"ip\":\"" + LOCAL_IP + "\",\"publicIp\":\"" + PUBLIC_IP + 
            "\",\"resolution\":\"" + Screen.PrimaryScreen.Bounds.Width + "x" + Screen.PrimaryScreen.Bounds.Height + 
            "\",\"userId\":\"jay\",\"version\":\"2.4\"}";
        Post(SERVER + "/api/devices", json);
        Console.WriteLine("Heartbeat OK");
    }
    
    static void SendScreenshot() {
        var bounds = Screen.PrimaryScreen.Bounds;
        using (var bmp = new Bitmap(bounds.Width, bounds.Height))
        using (var g = Graphics.FromImage(bmp)) {
            g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
            using (var ms = new MemoryStream()) {
                var encoder = GetEncoder(ImageFormat.Jpeg);
                var ep = new EncoderParameters(1);
                ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 35L);
                bmp.Save(ms, encoder, ep);
                string b64 = Convert.ToBase64String(ms.ToArray());
                string json = "{\"deviceId\":\"" + DEVICE_ID + "\",\"image\":\"" + b64 + "\"}";
                Post(SERVER + "/api/screenshot", json);
                Console.WriteLine("Frame sent (" + (ms.Length/1024) + "KB)");
            }
        }
    }
    
    static void PollCommands() {
        try {
            var req = (HttpWebRequest)WebRequest.Create(SERVER + "/api/commands?deviceId=" + Uri.EscapeDataString(DEVICE_ID));
            req.Timeout = 5000;
            using (var res = req.GetResponse())
            using (var sr = new StreamReader(res.GetResponseStream())) {
                string body = sr.ReadToEnd();
                if (string.IsNullOrEmpty(body) || body == "[]") return;
                var ser = new JavaScriptSerializer();
                var cmds = ser.Deserialize<object[]>(body);
                foreach (var obj in cmds) {
                    var cmd = (System.Collections.Generic.Dictionary<string, object>)obj;
                    string action = cmd["action"].ToString();
                    var data = cmd.ContainsKey("data") ? (System.Collections.Generic.Dictionary<string, object>)cmd["data"] : null;
                    ExecuteCommand(action, data);
                }
            }
        } catch { }
    }
    
    static void ExecuteCommand(string action, System.Collections.Generic.Dictionary<string, object> data) {
        Console.WriteLine("CMD: " + action);
        int x, y;
        switch (action) {
            case "click":
                x = Convert.ToInt32(data["x"]); y = Convert.ToInt32(data["y"]);
                SetCursorPos(x, y); Thread.Sleep(50);
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                break;
            case "rightclick":
                x = Convert.ToInt32(data["x"]); y = Convert.ToInt32(data["y"]);
                SetCursorPos(x, y); Thread.Sleep(50);
                mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
                mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
                break;
            case "doubleclick":
                x = Convert.ToInt32(data["x"]); y = Convert.ToInt32(data["y"]);
                SetCursorPos(x, y); Thread.Sleep(50);
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                Thread.Sleep(100);
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                break;
            case "move":
                x = Convert.ToInt32(data["x"]); y = Convert.ToInt32(data["y"]);
                SetCursorPos(x, y);
                break;
            case "type":
                SendKeys.SendWait(data["text"].ToString());
                break;
            case "key":
                SendKeys.SendWait(data["key"].ToString());
                break;
        }
    }
    
    static ImageCodecInfo GetEncoder(ImageFormat format) {
        foreach (var codec in ImageCodecInfo.GetImageEncoders())
            if (codec.FormatID == format.Guid) return codec;
        return null;
    }
    
    static void Post(string url, string json) {
        var req = (HttpWebRequest)WebRequest.Create(url);
        req.Method = "POST";
        req.ContentType = "application/json";
        req.Timeout = 15000;
        byte[] data = Encoding.UTF8.GetBytes(json);
        req.ContentLength = data.Length;
        using (var stream = req.GetRequestStream()) stream.Write(data, 0, data.Length);
        using (var res = req.GetResponse()) { }
    }
}
