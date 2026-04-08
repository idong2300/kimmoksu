const firebaseConfig = {
    // ... 준호님의 기존 설정값 그대로 유지 ...
    apiKey: "AIzaSyDjvv8ezS7OJgfwEfEh8Xwou9_bW7jzJ3w",
    authDomain: "kimmoksu-35d62.firebaseapp.com",
    projectId: "kimmoksu-35d62",
    storageBucket: "kimmoksu-35d62.firebasestorage.app",
    messagingSenderId: "104444016578",
    appId: "1:104444016578:web:09f9feeb61bf78ef23c85b",
    measurementId: "G-W7QBSQTX3J"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // 이 줄을 추가해서 인증 기능을 켭니다.

// 로그인 체크 함수 업그레이드
function authCheck() {
    const user = auth.currentUser;
    if (!user) {
        // 로그인이 안 되어 있다면 메인으로 보냄
        location.href = 'index.html';
    }
    return user;
}
