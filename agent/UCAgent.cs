using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Management;

class UCAgent {
    static string SERVER = "https://uc-universal-connect-omega.vercel.app";
    static string DEVICE_ID;
    
    static void Main() {
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
        Console.WriteLine("UC Agent v2.2 starting...");
        try {
            var searcher = new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct");
            string uuid = "unknown";
            foreach (ManagementObject mo in searcher.Get()) { uuid = mo["UUID"].ToString(); break; }
            DEVICE_ID = Environment.MachineName + "-" + uuid;
        } catch { DEVICE_ID = Environment.MachineName; }
        
        int n = 0;
        while (true) {
            try {
                if (n % 10 == 0) SendHeartbeat();
                SendScreenshot();
            } catch (Exception ex) { Console.WriteLine("ERR: " + ex.Message); }
            n++;
            Thread.Sleep(3000);
        }
    }
    
    static void SendHeartbeat() {
        string json = "{\"deviceId\":\"" + DEVICE_ID + "\",\"name\":\"" + Environment.MachineName + 
            "\",\"os\":\"Windows\",\"ip\":\"local\",\"resolution\":\"" + 
            Screen.PrimaryScreen.Bounds.Width + "x" + Screen.PrimaryScreen.Bounds.Height + 
            "\",\"userId\":\"jay\",\"version\":\"2.2\"}";
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
