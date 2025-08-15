import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, PermissionsAndroid, Platform, Modal, Alert
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, NativeModules } from "react-native";
import { WebView } from "react-native-webview";

const { FloatingOverlay } = NativeModules;

// Lấy danh sách acc TikTok liên kết với Golike
async function fetchTiktokAccounts(auth: string): Promise<{username: string}[]> {
  const resp = await fetch("https://app.golike.net/api/linked-social-accounts/list", {
    headers: { Authorization: auth }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.data || [])
    .filter((acc: any) => acc.platform === "tiktok")
    .map((acc: any) => ({ username: acc.username || acc.name }));
}

// Kiểm tra authorization hợp lệ, trả về user info nếu đúng, null nếu sai
async function checkAuthorization(auth: string): Promise<null | {username: string}> {
  try {
    const resp = await fetch("https://app.golike.net/api/user/info", {
      headers: { Authorization: auth }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.data && data.data.username) return { username: data.data.username };
    return null;
  } catch {
    return null;
  }
}

// Nhận job follow TikTok
async function fetchJob(auth: string) {
  const resp = await fetch("https://app.golike.net/api/jobs/next-job?job_type=tiktok_follow", {
    headers: { Authorization: auth }
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data || null;
}

export default function App() {
  const [authorization, setAuthorization] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [tiktokAccount, setTiktokAccount] = useState("");
  const [accounts, setAccounts] = useState<{username: string}[]>([]);
  const [overlayVisible, setOverlayVisible] = useState(false); // dùng cho modal RN, có thể bỏ nếu dùng native overlay
  const [userGoLike, setUserGoLike] = useState("");
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [jobCount, setJobCount] = useState(0);
  const [xu, setXu] = useState(0);
  const [authStatus, setAuthStatus] = useState<"idle"|"checking"|"valid"|"invalid">("idle");
  const jobInterval = useRef<any>(null);

  // WebView login state
  const [showWebLogin, setShowWebLogin] = useState(false);

  // Lưu lại authorization
  useEffect(() => {
    AsyncStorage.getItem("authorization").then(auth => {
      if (auth) setAuthorization(auth);
    });
  }, []);
  useEffect(() => {
    if (authorization) AsyncStorage.setItem("authorization", authorization);
  }, [authorization]);

  // Khi authorization thay đổi, kiểm tra hợp lệ rồi mới lấy danh sách acc
  useEffect(() => {
    if (!authorization) {
      setAccounts([]);
      setUserGoLike("");
      setAuthStatus("idle");
      setTiktokAccount("");
      return;
    }
    setAuthStatus("checking");
    checkAuthorization(authorization).then((userInfo) => {
      if (userInfo) {
        setAuthStatus("valid");
        setUserGoLike(userInfo.username);
        fetchTiktokAccounts(authorization).then(setAccounts);
      } else {
        setAuthStatus("invalid");
        setUserGoLike("");
        setAccounts([]);
        setTiktokAccount("");
      }
    });
  }, [authorization]);

  // Khi bật automation
  useEffect(() => {
    if (isEnabled) {
      // Kiểm tra acc tiktok nhập vào phải có trong list
      if (!accounts.find(acc => acc.username === tiktokAccount)) {
        Alert.alert("Lỗi", "Vui lòng nhập chính xác tên tài khoản TikTok đã liên kết bên dưới để sử dụng.");
        setIsEnabled(false);
        return;
      }
      // Gọi overlay native
      FloatingOverlay.startOverlay(
        userGoLike || "",
        tiktokAccount || "",
        jobCount,
        xu,
        jobInfo?.status || "Đang chạy..."
      );
      startJobAutomation();
      askPermissions();
    } else {
      FloatingOverlay.stopOverlay();
      stopJobAutomation();
    }
    return stopJobAutomation;
    // eslint-disable-next-line
  }, [isEnabled]);

  // Khi trạng thái job thay đổi thì cập nhật overlay
  useEffect(() => {
    if (isEnabled) {
      FloatingOverlay.startOverlay(
        userGoLike || "",
        tiktokAccount || "",
        jobCount,
        xu,
        jobInfo?.status || "Đang chạy..."
      );
    }
  }, [jobInfo, jobCount, xu, isEnabled, userGoLike, tiktokAccount]);

  // Xin quyền overlay, accessibility
  async function askPermissions() {
    if (Platform.OS === "android") {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW
      );
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    }
  }

  // Hàm tự động nhận job
  function startJobAutomation() {
    if (jobInterval.current) return;
    let stopped = false;
    async function loop() {
      if (!authorization || !tiktokAccount) return;
      const job = await fetchJob(authorization);
      if (!job) return;
      setJobInfo(job);
      setJobCount((c) => c + 1);
      setXu(job.bonus || 0);
      // Mở link TikTok
      if (job.social_link) await Linking.openURL(job.social_link);
      // Đợi accessibility service auto "Follow"
      await sleep(10000);
      // Gọi "Hoàn thành" (cần gửi request lên server Golike)
      if (job.id) {
        await fetch(`https://app.golike.net/api/jobs/${job.id}/complete`, {
          method: "POST",
          headers: { Authorization: authorization }
        });
      }
      await sleep(10000);
      if (!stopped) loop();
    }
    loop();
    jobInterval.current = () => { stopped = true; };
  }
  function stopJobAutomation() {
    if (jobInterval.current) {
      jobInterval.current();
      jobInterval.current = null;
    }
  }
  function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // Inject JS để lấy token từ localStorage["vuex"] sau login
  const injectedJS = `
    setTimeout(function() {
      var vuex = localStorage.getItem("vuex");
      if (vuex) {
        var obj = JSON.parse(vuex);
        var token = obj.token;
        window.ReactNativeWebView.postMessage(token || "");
      } else {
        window.ReactNativeWebView.postMessage("");
      }
    }, 1200);
    true;
  `;

  function onWebViewMessage(event: any) {
    const token = event.nativeEvent.data;
    if (token) {
      setAuthorization(token.startsWith("Bearer ") ? token : `Bearer ${token}`);
      setShowWebLogin(false);
    } else {
      Alert.alert("Không lấy được Authorization, vui lòng thử lại!");
    }
  }

  return (
    <View style={styles.container}>
      {/* Thay trường nhập Authorization bằng nút đăng nhập */}
      {authorization ? (
        <View>
          <Text style={{color: "#158a31", marginBottom: 6}}>Đã đăng nhập Golike!</Text>
          <TouchableOpacity
            style={styles.green}
            onPress={() => {
              setAuthorization("");
              setUserGoLike("");
              setAccounts([]);
              setTiktokAccount("");
              setAuthStatus("idle");
            }}
          >
            <Text style={{color: "#fff"}}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.green}
          onPress={() => setShowWebLogin(true)}
        >
          <Text style={{color: "#fff", fontWeight: "bold"}}>Đăng nhập Golike</Text>
        </TouchableOpacity>
      )}

      {authStatus === "checking" && (
        <Text style={{color: "#2469c8", marginBottom: 6}}>Đang kiểm tra Authorization...</Text>
      )}
      {authStatus === "invalid" && (
        <Text style={{color: "red", marginBottom: 6}}>Authorization không hợp lệ!</Text>
      )}

      {/* Xanh nước biển - nút bật/tắt */}
      <TouchableOpacity
        style={[
          styles.blue,
          {opacity: authStatus === "valid" && tiktokAccount ? 1 : 0.5}
        ]}
        onPress={() => setIsEnabled((e) => !e)}
        disabled={authStatus !== "valid" || !tiktokAccount}
      >
        <Text style={{color: "#fff", fontWeight: "bold"}}>{isEnabled ? "Tắt" : "Bật"}</Text>
      </TouchableOpacity>
      {/* Vàng - nhập tài khoản tiktok */}
      <TextInput
        style={styles.yellow}
        placeholder="Nhập chính xác tên TikTok để sử dụng"
        value={tiktokAccount}
        onChangeText={setTiktokAccount}
        autoCapitalize="none"
        autoCorrect={false}
        editable={authStatus === "valid"}
      />
      {/* Đỏ - danh sách acc tiktok liên kết */}
      <View style={styles.red}>
        <Text style={{color: "#fff", fontWeight: "bold"}}>Danh sách acc TikTok liên kết:</Text>
        <FlatList
          data={accounts}
          keyExtractor={item => item.username}
          renderItem={({item}) => (
            <Text style={{color: "#fff"}}>{item.username}</Text>
          )}
          ListEmptyComponent={() => (
            <Text style={{color: "#fff"}}>Chưa có tài khoản TikTok liên kết</Text>
          )}
        />
      </View>

      {/* WebView đăng nhập Golike */}
      <Modal
        visible={showWebLogin}
        animationType="slide"
        onRequestClose={() => setShowWebLogin(false)}
      >
        <WebView
          source={{ uri: "https://app.golike.net/login" }}
          injectedJavaScript={injectedJS}
          onMessage={onWebViewMessage}
          startInLoadingState={true}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 20,
    flex: 1,
    backgroundColor: "#fff"
  },
  green: {
    borderWidth: 2,
    borderColor: "#158a31",
    backgroundColor: "#25c43a",
    color: "#fff",
    padding: 15,
    fontSize: 18,
    marginBottom: 10,
    borderRadius: 8,
  },
  blue: {
    borderWidth: 2,
    borderColor: "#2469c8",
    backgroundColor: "#22b6fc",
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    alignSelf: "flex-start",
    marginLeft: 8,
    opacity: 1
  },
  yellow: {
    borderWidth: 2,
    borderColor: "#a2920e",
    backgroundColor: "#ffe600",
    color: "#444",
    padding: 14,
    fontSize: 18,
    marginBottom: 10,
    borderRadius: 8,
  },
  red: {
    borderWidth: 2,
    borderColor: "#c81a1a",
    backgroundColor: "#f91c1c",
    padding: 18,
    borderRadius: 8,
    minHeight: 200,
    marginTop: 10,
  }
});
