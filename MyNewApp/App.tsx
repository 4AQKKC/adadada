import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, PermissionsAndroid, Platform, Modal, Alert
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

// Kiểm tra Authorization hợp lệ, trả về user info nếu đúng, null nếu sai/lỗi mạng
async function checkAuthorization(auth: string): Promise<null | {username: string}> {
  try {
    const resp = await fetch("https://app.golike.net/api/user/info", {
      headers: { Authorization: auth }
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    if (!data || !data.data || !data.data.username) return null;
    return { username: data.data.username };
  } catch {
    return null;
  }
}

// Lấy danh sách acc TikTok liên kết với Golike, luôn trả về array (không undefined/null)
async function fetchTiktokAccounts(auth: string): Promise<{username: string}[]> {
  try {
    const resp = await fetch("https://app.golike.net/api/linked-social-accounts/list", {
      headers: { Authorization: auth }
    });
    if (!resp.ok) return [];
    const data = await resp.json().catch(() => null);
    if (!data || !data.data) return [];
    return (data.data || [])
      .filter((acc: any) => acc.platform === "tiktok")
      .map((acc: any) => ({ username: acc.username || acc.name }));
  } catch {
    return [];
  }
}

// Nhận job follow TikTok
async function fetchJob(auth: string) {
  try {
    const resp = await fetch("https://app.golike.net/api/jobs/next-job?job_type=tiktok_follow", {
      headers: { Authorization: auth }
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    return data && data.data ? data.data : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [authorization, setAuthorization] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [tiktokAccount, setTiktokAccount] = useState("");
  const [accounts, setAccounts] = useState<{username: string}[]>([]);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [userGoLike, setUserGoLike] = useState("");
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [jobCount, setJobCount] = useState(0);
  const [xu, setXu] = useState(0);
  const [authStatus, setAuthStatus] = useState<"idle"|"checking"|"valid"|"invalid">("idle");
  const jobInterval = useRef<any>(null);

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
    }).catch(() => {
      setAuthStatus("invalid");
      setUserGoLike("");
      setAccounts([]);
      setTiktokAccount("");
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
      setOverlayVisible(true);
      startJobAutomation();
      askPermissions();
    } else {
      setOverlayVisible(false);
      stopJobAutomation();
    }
    return stopJobAutomation;
    // eslint-disable-next-line
  }, [isEnabled]);

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
      if (job.social_link) await Linking.openURL(job.social_link).catch(()=>{});
      // Đợi accessibility service auto "Follow"
      await sleep(10000);
      // Gọi "Hoàn thành"
      if (job.id) {
        await fetch(`https://app.golike.net/api/jobs/${job.id}/complete`, {
          method: "POST",
          headers: { Authorization: authorization }
        }).catch(()=>{});
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

  return (
    <View style={styles.container}>
      {/* Xanh lá - nhập Authorization */}
      <TextInput
        style={styles.green}
        placeholder="Nhập Authorization Golike"
        value={authorization}
        onChangeText={setAuthorization}
        autoCapitalize="none"
        autoCorrect={false}
        editable={authStatus !== "checking"}
      />
      {/* Thông báo trạng thái authorization */}
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
          data={accounts || []}
          keyExtractor={item => item.username}
          renderItem={({item}) => (
            <Text style={{color: "#fff"}}>{item.username}</Text>
          )}
          ListEmptyComponent={() => (
            <Text style={{color: "#fff"}}>Chưa có tài khoản TikTok liên kết</Text>
          )}
        />
      </View>

      {/* Overlay GUI */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={overlayVisible}
        onRequestClose={() => setOverlayVisible(false)}
      >
        <View style={styles.overlayContainer}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayText}>GOLIKE: {userGoLike}</Text>
            <Text style={styles.overlayText}>TikTok: {tiktokAccount}</Text>
            <Text style={styles.overlayText}>
              Job: {jobCount}{jobInfo?.total ? `/${jobInfo.total}` : ""}
            </Text>
            <Text style={styles.overlayText}>xu: {xu} đồng</Text>
            <Text style={styles.overlayText}>tt: {jobInfo?.status || "Đang chạy..."}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ... (styles giữ nguyên như cũ)
