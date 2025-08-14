import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, PermissionsAndroid, Platform, Modal
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

// Hàm fetch các acc TikTok đã liên kết với acc Golike
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

// Hàm tự động nhận job
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
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [userGoLike, setUserGoLike] = useState("");
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [jobCount, setJobCount] = useState(0);
  const [xu, setXu] = useState(0);
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

  // Lấy danh sách acc TikTok khi có auth
  useEffect(() => {
    if (authorization) {
      fetchTiktokAccounts(authorization).then(setAccounts);
      // Lấy tên user GoLike
      fetch("https://app.golike.net/api/user/info", { headers: { Authorization: authorization } })
        .then(r => r.json())
        .then(data => setUserGoLike(data.data?.username || ""));
    }
  }, [authorization]);

  // Khi bật automation
  useEffect(() => {
    if (isEnabled) {
      setOverlayVisible(true);
      startJobAutomation();
      askPermissions();
    } else {
      setOverlayVisible(false);
      stopJobAutomation();
    }
    return stopJobAutomation;
  }, [isEnabled]);

  // Xin quyền overlay, accessibility
  async function askPermissions() {
    if (Platform.OS === "android") {
      // Overlay
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW
      );
      // File
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
      // Accessibility: user vào Settings bật thủ công
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
      // Gọi "Hoàn thành" (cần gửi request lên server Golike hoặc mô phỏng click, demo chỉ fetch)
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

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.green}
        placeholder="Nhập Authorization Golike"
        value={authorization}
        onChangeText={setAuthorization}
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.blue} onPress={() => setIsEnabled((e) => !e)}>
        <Text style={{color: "#fff", fontWeight: "bold"}}>{isEnabled ? "Tắt" : "Bật"}</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.yellow}
        placeholder="Tài khoản TikTok đang dùng"
        value={tiktokAccount}
        onChangeText={setTiktokAccount}
      />
      <View style={styles.red}>
        <Text style={{color: "#fff", fontWeight: "bold"}}>Danh sách acc TikTok liên kết:</Text>
        <FlatList
          data={accounts}
          keyExtractor={item => item.username}
          renderItem={({item}) => (
            <Text style={{color: "#fff"}}>{item.username}</Text>
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
    minHeight: 150,
    marginTop: 10,
  },
  overlayContainer: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 120, // 4cm cho màn hình ~30px/cm
    height: 90, // 3cm
    backgroundColor: "rgba(50,50,50,0.35)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "flex-start",
    elevation: 10,
  },
  overlayBox: {
    padding: 8,
    width: "100%",
    height: "100%",
    borderRadius: 12,
    opacity: 0.9,
  },
  overlayText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
    marginBottom: 2,
    textShadowColor: "#333",
    textShadowRadius: 2,
    textShadowOffset: {width:1, height:1}
  }
});
