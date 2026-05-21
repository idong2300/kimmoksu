    // 공정표 (Gantt)
    let ganttTasks = ["철거", "목공", "전기", "필름", "도장", "소방", "가구", "바닥", "유리", "금속", "사인", "설비", "청소", "기타 잔손"];
    let ganttDates = [];
    let ganttState = {};
    let ganttProgressState = {};
    let currentGanttId = null;
    let ganttEditMode = "plan";
    let activeGanttFilter = "mine";
    let cachedGanttLogs = [];
    // 💡 V35: 공정표 메모 기능 전역 변수 💡
    let ganttMemos = {};
    let isGanttLongPress = false;
    // 💡 V36: 공정표 메모 모달에서 현재 조작 중인 셀 키 보관 💡
    let currentGanttMemoKey = null;
    
    function formatComma(input) { let val = input.value.replace(/[^0-9]/g, ''); input.value = val ? Number(val).toLocaleString() : ''; }

    function openGanttCreateModal() { document.getElementById('newGanttName').value = ''; document.getElementById('newGanttDate').value = ''; ganttModal.show(); }
    function submitNewProject() {
        let name = document.getElementById('newGanttName').value.trim(); let dVal = document.getElementById('newGanttDate').value.trim();
        if(!name || dVal.length !== 8) return alert("현장명과 착공일(8자리)을 입력하세요.");
        let start = new Date(dVal.substring(0,4), parseInt(dVal.substring(4,6))-1, dVal.substring(6,8));
        ganttDates = [];
        ganttState = {};
        ganttProgressState = {};
        ganttMemos = {};
        currentGanttId = null;
        ganttEditMode = "plan";
        document.getElementById('ganttSiteName').value = name;
        setGanttEditMode("plan");
        for(let i=0; i<45; i++) { let dt = new Date(start); dt.setDate(start.getDate()+i); ganttDates.push(dt); }
        document.getElementById('ganttDashboard').style.display = 'block'; document.getElementById('extraCostBody').innerHTML = ''; calcExtraSum(); renderGantt(); ganttModal.hide();
    }
    function renderGantt() {
        if(ganttDates.length === 0) return;
        let monthCounts = []; let currentMonth = ganttDates[0].getMonth(); let count = 0;
        ganttDates.forEach(d => { if(d.getMonth() === currentMonth) count++; else { monthCounts.push({m: currentMonth, c: count}); currentMonth = d.getMonth(); count = 1; } });
        monthCounts.push({m: currentMonth, c: count});
        let monthHtml = `<tr class="gantt-month-row"><th class="gantt-task-col text-center">월 구분</th>` + monthCounts.map(mc => `<th colspan="${mc.c}" class="text-center">${mc.m + 1}월</th>`).join('') + `</tr>`;
        const thead = ganttDates.map(d => `<th class="gantt-date-th ${d.getDay()===0?'day-sun':(d.getDay()===6?'day-sat':'')}">${d.getDate()}</th>`).join('');
        let html = `<thead>${monthHtml}<tr><th class="gantt-task-col text-secondary">공종</th>${thead}</tr></thead><tbody>`;
        ganttTasks.forEach((task, tIdx) => {
            html += `<tr><td class="gantt-task-col"><input type="text" class="task-editable" value="${task}" onchange="ganttTasks[${tIdx}]=this.value"></td>`;
            ganttDates.forEach((d, dIdx) => {
                let key = `${tIdx}_${dIdx}`;
                let bg = d.getDay()===0?'day-sun':(d.getDay()===6?'day-sat':'');
                // 💡 V35: 메모 마커 + 툴팁 추가 💡
                let memo = ganttMemos[key];
                let memoClass = memo ? 'has-memo' : '';
                // 💡 이전버전: 기본 title 속성 제거 - 커스텀 툴팁으로 대체 💡
                // 메모 본문은 data-memo 속성에 저장 (커스텀 툴팁이 읽어감)
                let memoDataAttr = memo ? `data-memo="${memo.replace(/"/g, '&quot;')}"` : '';
                const isPlanned = !!ganttState[key];
                const isProgress = !!ganttProgressState[key];
                
                let stateClass = "";
                if (isPlanned) stateClass += " gantt-active";
                if (isProgress && isPlanned) stateClass += " gantt-progress";
                if (isProgress && !isPlanned) stateClass += " gantt-progress-only";
                
                html += `<td class="gantt-cell ${bg} ${stateClass} ${memoClass}" data-key="${key}" ${memoDataAttr} onclick="toggleGantt('${key}')"></td>`;
            });
            html += `</tr>`;
        });
        document.getElementById('ganttTable').innerHTML = html + `</tbody>`;
        // 💡 V35: 렌더링 직후 길게 누르기 이벤트 재바인딩 💡
        bindGanttLongPress();
    }

    // 💡 V36: 공정표 메모 모달 제어 함수들 💡
    function openGanttMemoModal(key) {
        currentGanttMemoKey = key;
        const existing = ganttMemos[key] || '';
        document.getElementById('ganttMemoInput').value = existing;
        // 어느 칸인지 표시
        const [tIdx, dIdx] = key.split('_').map(Number);
        const taskName = ganttTasks[tIdx] || '';
        const dateObj = ganttDates[dIdx];
        const dateStr = dateObj ? `${dateObj.getMonth()+1}/${dateObj.getDate()}` : '';
        document.getElementById('ganttMemoCellInfo').innerHTML = `<i class="bi bi-geo-alt"></i> <b>${taskName}</b> 공종 / <b>${dateStr}</b>`;
        document.getElementById('ganttMemoModal').style.display = 'flex';
        setTimeout(() => { document.getElementById('ganttMemoInput').focus(); }, 100);
    }

    function saveGanttMemo() {
        if(!currentGanttMemoKey) return closeGanttMemoModal();
        const val = document.getElementById('ganttMemoInput').value.trim();
        if(val === '') {
            // 빈 값 저장 시 메모 삭제와 동일 처리
            delete ganttMemos[currentGanttMemoKey];
        } else {
            ganttMemos[currentGanttMemoKey] = val;
        }
        renderGantt();
        closeGanttMemoModal();
    }

    function deleteGanttMemo() {
        if(!currentGanttMemoKey) return closeGanttMemoModal();
        if(!ganttMemos[currentGanttMemoKey]) {
            // 원래 없던 메모면 그냥 닫기만
            return closeGanttMemoModal();
        }
        if(!confirm('이 메모를 삭제하시겠습니까?')) return;
        delete ganttMemos[currentGanttMemoKey];
        renderGantt();
        closeGanttMemoModal();
    }

    function closeGanttMemoModal() {
        document.getElementById('ganttMemoModal').style.display = 'none';
        document.getElementById('ganttMemoInput').value = '';
        currentGanttMemoKey = null;
    }

    // 💡 V35: 공정표 셀 길게 누르기(500ms) → 메모 입력/삭제 💡
    function bindGanttLongPress() {
        document.querySelectorAll('#ganttTable .gantt-cell').forEach(cell => {
            let timer = null;
            const startPress = (e) => {
                timer = setTimeout(() => {
                    isGanttLongPress = true;
                    const key = cell.getAttribute('data-key');
                    if(!key) return;
                    // 💡 V36: prompt() 대신 모달 호출 💡
                    openGanttMemoModal(key);
                    // 짧은 지연 후 플래그 리셋 (모달 외 영역 클릭 잔여 처리 방지)
                    setTimeout(() => { isGanttLongPress = false; }, 150);
                }, 500);
            };
            const cancelPress = () => {
                if(timer) { clearTimeout(timer); timer = null; }
            };
            cell.addEventListener('mousedown', startPress);
            cell.addEventListener('touchstart', startPress, { passive: true });
            cell.addEventListener('mouseup', cancelPress);
            cell.addEventListener('mouseleave', cancelPress);
            cell.addEventListener('touchend', cancelPress);
            cell.addEventListener('touchcancel', cancelPress);

            // 💡 이전버전: 커스텀 툴팁 이벤트 (메모 있는 셀만) 💡
            if(cell.classList.contains('has-memo')) {
                // PC: 마우스 호버 시 즉시 표시
                cell.addEventListener('mouseenter', showGanttTooltip);
                cell.addEventListener('mouseleave', hideGanttTooltip);
            }
        });
    }

    // 💡 이전버전: 공정표 커스텀 툴팁 표시/숨김 함수 💡
    function showGanttTooltip(e) {
        const cell = e.currentTarget;
        const memo = cell.getAttribute('data-memo');
        if(!memo) return;
        const tooltip = document.getElementById('gantt-custom-tooltip');
        if(!tooltip) return;

        tooltip.textContent = memo;
        tooltip.style.display = 'block';

        // 위치 계산: 셀 우측 상단에 띄우되, 화면 밖으로 나가지 않도록 보정
        const rect = cell.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        let left = rect.right + scrollX + 8;
        let top = rect.top + scrollY - 4;

        // 우측이 화면 밖으로 나가면 셀 좌측에 표시
        if(left + tipRect.width > window.innerWidth + scrollX) {
            left = rect.left + scrollX - tipRect.width - 8;
        }
        // 너무 위로 가면 셀 아래에 표시
        if(top < scrollY + 5) {
            top = rect.bottom + scrollY + 8;
        }
        tooltip.style.left = Math.max(5, left) + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideGanttTooltip() {
        const tooltip = document.getElementById('gantt-custom-tooltip');
        if(tooltip) tooltip.style.display = 'none';
    }

    // 💡 이전버전: 모바일 터치 시 다른 곳 터치하면 툴팁 닫기 + 메모 셀 탭으로 보기 💡
    document.addEventListener('touchstart', function(e) {
        const cell = e.target.closest('.gantt-cell.has-memo');
        if(cell) {
            // 메모 있는 셀 터치 시 툴팁 표시 (롱프레스가 시작되기 전 짧은 탭 대응)
            // → 단, 롱프레스로 모달이 열릴 가능성도 있으니 먼저 표시만 해두고
            //    모달이 열리면 자연스레 가려지도록 둠. 다른 곳 터치 시 닫힘.
            showGanttTooltip({ currentTarget: cell });
        } else {
            hideGanttTooltip();
        }
    }, { passive: true });

    function setGanttEditMode(mode) {
        ganttEditMode = mode === "progress" ? "progress" : "plan";
    
        const planBtn = document.getElementById("btnGanttPlanMode");
        const progressBtn = document.getElementById("btnGanttProgressMode");
    
        if (planBtn) {
            planBtn.className = ganttEditMode === "plan"
                ? "btn btn-sm btn-primary px-2 fw-bold text-nowrap"
                : "btn btn-sm btn-outline-primary px-2 fw-bold text-nowrap";
        }
    
        if (progressBtn) {
            progressBtn.className = ganttEditMode === "progress"
                ? "btn btn-sm btn-warning px-2 fw-bold text-dark text-nowrap"
                : "btn btn-sm btn-outline-warning px-2 fw-bold text-nowrap";
        }
    }

    function toggleGantt(key) {
        if (isGanttLongPress) return;
    
        if (ganttEditMode === "progress") {
            if (ganttProgressState[key]) {
                delete ganttProgressState[key];
            } else {
                ganttProgressState[key] = true;
            }
        } else {
            if (ganttState[key]) {
                delete ganttState[key];
            } else {
                ganttState[key] = true;
            }
        }
    
        renderGantt();
    }
    function addGanttTaskRow() { ganttTasks.push("새 공종"); renderGantt(); }
    
    function addGanttDate() { let lastD = new Date(ganttDates[ganttDates.length-1]); lastD.setDate(lastD.getDate() + 1); ganttDates.push(lastD); renderGantt(); }
    function removeGanttDate() { if(ganttDates.length > 1) { ganttDates.pop(); renderGantt(); } } 

    function prependGanttDate() {
        if (ganttDates.length === 0) return;
    
        let firstD = new Date(ganttDates[0]);
        firstD.setDate(firstD.getDate() - 1);
        ganttDates.unshift(firstD);
    
        let newState = {};
        let newProgressState = {};
        let newMemos = {};
    
        for (let tIdx = 0; tIdx < ganttTasks.length; tIdx++) {
            for (let dIdx = 0; dIdx < ganttDates.length - 1; dIdx++) {
                if (ganttState[`${tIdx}_${dIdx}`]) {
                    newState[`${tIdx}_${dIdx + 1}`] = true;
                }
    
                if (ganttProgressState[`${tIdx}_${dIdx}`]) {
                    newProgressState[`${tIdx}_${dIdx + 1}`] = true;
                }
    
                if (ganttMemos[`${tIdx}_${dIdx}`]) {
                    newMemos[`${tIdx}_${dIdx + 1}`] = ganttMemos[`${tIdx}_${dIdx}`];
                }
            }
        }
    
        ganttState = newState;
        ganttProgressState = newProgressState;
        ganttMemos = newMemos;
    
        renderGantt();
    }

    function removeFirstGanttDate() {
        if (ganttDates.length > 1) {
            ganttDates.shift();
    
            let newState = {};
            let newProgressState = {};
            let newMemos = {};
    
            for (let tIdx = 0; tIdx < ganttTasks.length; tIdx++) {
                for (let dIdx = 1; dIdx <= ganttDates.length; dIdx++) {
                    if (ganttState[`${tIdx}_${dIdx}`]) {
                        newState[`${tIdx}_${dIdx - 1}`] = true;
                    }
    
                    if (ganttProgressState[`${tIdx}_${dIdx}`]) {
                        newProgressState[`${tIdx}_${dIdx - 1}`] = true;
                    }
    
                    if (ganttMemos[`${tIdx}_${dIdx}`]) {
                        newMemos[`${tIdx}_${dIdx - 1}`] = ganttMemos[`${tIdx}_${dIdx}`];
                    }
                }
            }
    
            ganttState = newState;
            ganttProgressState = newProgressState;
            ganttMemos = newMemos;
    
            renderGantt();
        }
    }

    function captureGantt() {
        const area = document.getElementById('captureArea');
        const wrap = document.getElementById('ganttScrollWrapper');
        const siteName = (document.getElementById('ganttSiteName').value.trim() || '현장').replace(/[\\/:*?"<>|]/g, '_');
        if(!area || !wrap) return;

        const originalOverflowX = wrap.style.overflowX;
        const originalAreaWidth = area.style.width;
        const replacedInputs = [];

        // 캡처 전 현재 공종명 input 값을 전역 배열에 반영
        document.querySelectorAll('#ganttTable .task-editable').forEach((input, idx) => {
            ganttTasks[idx] = input.value;
        });

        try {
            area.classList.add('gantt-capture-mode');
            wrap.style.overflowX = 'visible';
            area.style.width = 'max-content';

            // html2canvas가 sticky input을 캡처할 때 잘리는 문제 방지: 캡처 중에만 텍스트 span으로 교체
            document.querySelectorAll('#ganttTable .task-editable').forEach(input => {
                const span = document.createElement('span');
                span.className = 'capture-task-text';
                span.textContent = input.value || '';
                input.parentNode.insertBefore(span, input);
                input.style.display = 'none';
                replacedInputs.push({ input, span });
            });

            setTimeout(() => {
                html2canvas(area, {
                    backgroundColor: document.body.classList.contains('light-mode') ? '#ffffff' : '#1e222d',
                    scale: 2,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: area.scrollWidth,
                    windowHeight: area.scrollHeight
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `${siteName}_예상_공정표.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }).catch(err => {
                    console.error('공정표 캡처 실패:', err);
                    alert('공정표 캡처 중 오류가 발생했습니다. 다시 시도해주세요.');
                }).finally(() => {
                    replacedInputs.forEach(({ input, span }) => {
                        input.style.display = '';
                        if(span && span.parentNode) span.parentNode.removeChild(span);
                    });
                    area.classList.remove('gantt-capture-mode');
                    wrap.style.overflowX = originalOverflowX;
                    area.style.width = originalAreaWidth;
                });
            }, 200);
        } catch(e) {
            replacedInputs.forEach(({ input, span }) => {
                input.style.display = '';
                if(span && span.parentNode) span.parentNode.removeChild(span);
            });
            area.classList.remove('gantt-capture-mode');
            wrap.style.overflowX = originalOverflowX;
            area.style.width = originalAreaWidth;
            console.error('공정표 캡처 준비 실패:', e);
            alert('공정표 캡처 준비 중 오류가 발생했습니다.');
        }
    }
    
    function addExtraCostRow(data = {}) {
        const tr = document.createElement('tr');
        let id = Date.now() + Math.floor(Math.random()*1000);
        let costVal = data.cost ? Number(data.cost).toLocaleString() : '';
        
        tr.innerHTML = `
            <td class="date-td"><input type="date" class="form-control form-control-sm input-dark ec-date" value="${data.date||''}"></td>
            <td class="desc-td"><input type="text" class="form-control form-control-sm input-dark ec-desc" placeholder="내용" value="${data.desc||''}"></td>
            <td class="cost-td"><input type="text" class="form-control form-control-sm input-dark text-end ec-cost" oninput="formatComma(this); calcExtraSum()" value="${costVal}" placeholder="금액(원)"></td>
            <td class="check-td-prog"><label class="d-md-none me-1">진행</label><input class="form-check-input ec-prog" type="checkbox" ${data.prog?'checked':''}></td>
            <td class="check-td-tax"><label class="d-md-none me-1">계산서</label><input class="form-check-input ec-tax" type="checkbox" ${data.tax?'checked':''}></td>
            <td class="note-td">
                <div class="d-md-none note-header" data-bs-toggle="collapse" data-bs-target="#note-${id}">비고 <i class="bi bi-chevron-down"></i></div>
                <div class="collapse d-md-block" id="note-${id}"><input type="text" class="form-control form-control-sm input-dark ec-note mt-2 mt-md-0" placeholder="메모를 입력하세요" value="${data.note||''}"></div>
            </td>
            <td class="del-td"><button class="btn btn-sm btn-outline-danger py-0 px-2 w-100 fw-bold" onclick="this.closest('tr').remove(); calcExtraSum();"><i class="bi bi-x-lg"></i></button></td>
        `;
        document.getElementById('extraCostBody').appendChild(tr); calcExtraSum();
    }
    
    function calcExtraSum() { 
        let s = 0; 
        document.querySelectorAll('.ec-cost').forEach(el => { let v = el.value.replace(/,/g, ''); s += parseInt(v || 0); }); 
        document.querySelectorAll('.extraTotalSumText').forEach(el => el.innerText = s.toLocaleString() + " 원"); 
    }
    
    async function saveGantt() {
        let site = document.getElementById('ganttSiteName').value.trim(); if(!site) return alert("현장명 입력 필요");
        let extra = []; document.querySelectorAll('#extraCostBody tr').forEach(tr => extra.push({ 
            date: tr.querySelector('.ec-date').value, 
            desc: tr.querySelector('.ec-desc').value, 
            cost: tr.querySelector('.ec-cost').value.replace(/,/g, ''),
            prog: tr.querySelector('.ec-prog').checked, 
            tax: tr.querySelector('.ec-tax').checked, 
            note: tr.querySelector('.ec-note').value 
        }));
        const data = {
            teamId: myTeamId,
            site: site,
            tasks: ganttTasks,
            dates: ganttDates.map(d => d.toISOString()),
            state: ganttState,
            progressState: ganttProgressState,
            memos: ganttMemos,
            extra: extra,
            updatedAt: Date.now(),
            lastModifier: userNickname,
            lastModifierEmail: myEmail
        };
        
        if (currentGanttId) {
            await db.collection("gantt_logs").doc(currentGanttId).update(data);
        } else {
            const res = await db.collection("gantt_logs").add({
                ...data,
                writerName: userNickname,
                writerEmail: myEmail,
                originalWriter: userNickname,
                isCompleted: false,
                completedAt: null,
                completedBy: null
            });
            currentGanttId = res.id;
        }
        
        alert("저장되었습니다.");
    }
    
    function loadGanttList() {
        db.collection("gantt_logs")
            .where("teamId", "==", myTeamId)
            .orderBy("updatedAt", "desc")
            .onSnapshot(ss => {
                cachedGanttLogs = ss.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
    
                renderGanttList();
            });
    }
    
    function switchGanttFilter(filter, btn) {
        activeGanttFilter = filter;
    
        document.querySelectorAll(".gantt-filter-btn").forEach(b => {
            b.classList.remove("btn-primary", "btn-success", "btn-outline-secondary", "btn-outline-success");
            b.classList.add("btn-outline-secondary");
        });
    
        if (btn) {
            btn.classList.remove("btn-outline-secondary", "btn-outline-success");
    
            if (filter === "done") {
                btn.classList.add("btn-success");
            } else {
                btn.classList.add("btn-primary");
            }
        }
    
        renderGanttList();
    }
    
    function renderGanttList() {
        const container = document.getElementById("saved-gantt-list");
        if (!container) return;
    
        let list = cachedGanttLogs;
    
        if (activeGanttFilter === "mine") {
            list = cachedGanttLogs.filter(log => {
                if (log.isCompleted) return false;
        
                const writerEmail = String(log.writerEmail || "").trim();
                const writerName = String(log.writerName || log.originalWriter || "").trim();
        
                // 작성자 이메일이 있으면 이메일 기준으로만 내 파일 판단
                if (writerEmail) {
                    return writerEmail === myEmail;
                }
        
                // 작성자 이메일이 없고 이름만 있으면 이름 기준으로 내 파일 판단
                if (writerName) {
                    return writerName === userNickname;
                }
        
                // 작성자 정보가 없는 구버전 파일만 임시로 내 파일에 표시
                return true;
            });
        } else if (activeGanttFilter === "all") {
            list = cachedGanttLogs.filter(log => !log.isCompleted);
        } else if (activeGanttFilter === "done") {
            list = cachedGanttLogs.filter(log => log.isCompleted);
        }
    
        if (list.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="t5-card p-4 text-center text-secondary">
                        표시할 공정표가 없습니다.
                    </div>
                </div>
            `;
            return;
        }
    
        container.innerHTML = list.map(d => {
            const ds = new Date(d.updatedAt || Date.now()).toLocaleDateString();
            const writer = d.writerName || d.originalWriter || d.lastModifier || "작성자 미지정";
            const completedBadge = d.isCompleted ? `<span class="badge bg-success ms-2">완료</span>` : "";
            const completedInfo = d.isCompleted
                ? `<br><span class="small text-success">완료자: ${d.completedBy || "-"}</span>`
                : "";
    
            const canTempEdit = myRole === "owner" || myRole === "admin";
    
            const tempEditButtons = canTempEdit ? `
                <button class="t5-btn-small bg-warning text-dark" onclick="tempEditGanttWriter('${d.id}')">작성자 수정</button>
                ${
                    d.isCompleted
                        ? `<button class="t5-btn-small bg-info text-white" onclick="toggleGanttCompleted('${d.id}', false)">완료 해제</button>`
                        : `<button class="t5-btn-small bg-success text-white" onclick="toggleGanttCompleted('${d.id}', true)">완료 처리</button>`
                }
            ` : "";
    
            return `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="t5-card p-4 d-flex flex-column h-100 mb-0 border border-secondary border-opacity-25" style="min-height: 150px;">
                        <div class="flex-grow-1">
                            <h5 class="fw-bold text-white text-truncate mb-1">
                                ${d.site || "-"} ${completedBadge}
                            </h5>
                            <span class="small text-secondary">
                                저장일: ${ds}<br>
                                작성자: ${writer}
                                ${d.lastModifier ? `<br>최근 수정: ${d.lastModifier}` : ""}
                                ${completedInfo}
                            </span>
                        </div>
    
                        <div class="d-flex gap-1 flex-wrap justify-content-end mt-3">
                            <button class="btn btn-primary px-3 fw-bold" onclick="loadGanttDoc('${d.id}')">불러오기</button>
                            ${tempEditButtons}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }
    
    async function loadGanttDoc(id) {
        const d = (await db.collection("gantt_logs").doc(id).get()).data();
    
        currentGanttId = id;
        document.getElementById('ganttSiteName').value = d.site;
    
        ganttTasks = d.tasks || ganttTasks;
        ganttState = d.state || {};
        ganttProgressState = d.progressState || {};
        ganttMemos = d.memos || {};
        ganttDates = (d.dates || []).map(str => new Date(str));
    
        ganttEditMode = "plan";
        setGanttEditMode("plan");
    
        document.getElementById('extraCostBody').innerHTML = '';
        (d.extra || []).forEach(ex => addExtraCostRow(ex));
    
        document.getElementById('ganttDashboard').style.display = 'block';
    
        renderGantt();
        calcExtraSum();
        window.scrollTo(0, 0);
    }
    async function deleteGantt() {
        if (confirm("이 공정표를 삭제하시겠습니까?")) {
            if (currentGanttId) await db.collection("gantt_logs").doc(currentGanttId).delete();
    
            document.getElementById('ganttDashboard').style.display = 'none';
    
            currentGanttId = null;
            ganttState = {};
            ganttProgressState = {};
            ganttMemos = {};
            ganttEditMode = "plan";
            setGanttEditMode("plan");
        }
    }
        if (!(myRole === "owner" || myRole === "admin")) {
            alert("작성자 수정 권한이 없습니다.");
            return;
        }
    
        const snap = await db.collection("gantt_logs").doc(id).get();
        if (!snap.exists) {
            alert("공정표 데이터를 찾을 수 없습니다.");
            return;
        }
    
        const d = snap.data() || {};
        const currentName = d.writerName || d.originalWriter || d.lastModifier || "";
        const currentEmail = d.writerEmail || d.lastModifierEmail || "";
    
        const nextName = prompt("작성자 이름을 입력하세요.", currentName);
        if (nextName === null) return;
    
        const nextEmail = prompt("작성자 이메일을 입력하세요.\n내 파일 분류에 사용됩니다.", currentEmail);
        if (nextEmail === null) return;
    
        const cleanName = nextName.trim();
        const cleanEmail = nextEmail.trim();
    
        if (!cleanName) {
            alert("작성자 이름은 비워둘 수 없습니다.");
            return;
        }
    
        await db.collection("gantt_logs").doc(id).update({
            writerName: cleanName,
            originalWriter: cleanName,
            writerEmail: cleanEmail,
            updatedAt: Date.now(),
            lastModifier: userNickname,
            lastModifierEmail: myEmail
        });
    
        alert("작성자 정보가 수정되었습니다.");
    }
    
    async function toggleGanttCompleted(id, nextCompleted) {
        if (!(myRole === "owner" || myRole === "admin")) {
            alert("완료 상태 변경 권한이 없습니다.");
            return;
        }
    
        const msg = nextCompleted
            ? "이 공정표를 완료 처리하시겠습니까?"
            : "이 공정표의 완료 상태를 해제하시겠습니까?";
    
        if (!confirm(msg)) return;
    
        await db.collection("gantt_logs").doc(id).update({
            isCompleted: !!nextCompleted,
            completedAt: nextCompleted ? Date.now() : null,
            completedBy: nextCompleted ? myEmail : null,
            updatedAt: Date.now(),
            lastModifier: userNickname,
            lastModifierEmail: myEmail
        });
    }

window.formatComma = formatComma;
window.openGanttCreateModal = openGanttCreateModal;
window.submitNewProject = submitNewProject;
window.renderGantt = renderGantt;
window.openGanttMemoModal = openGanttMemoModal;
window.saveGanttMemo = saveGanttMemo;
window.deleteGanttMemo = deleteGanttMemo;
window.closeGanttMemoModal = closeGanttMemoModal;
window.bindGanttLongPress = bindGanttLongPress;
window.showGanttTooltip = showGanttTooltip;
window.hideGanttTooltip = hideGanttTooltip;
window.toggleGantt = toggleGantt;
window.addGanttTaskRow = addGanttTaskRow;
window.addGanttDate = addGanttDate;
window.removeGanttDate = removeGanttDate;
window.prependGanttDate = prependGanttDate;
window.removeFirstGanttDate = removeFirstGanttDate;
window.captureGantt = captureGantt;
window.addExtraCostRow = addExtraCostRow;
window.calcExtraSum = calcExtraSum;
window.saveGantt = saveGantt;
window.loadGanttList = loadGanttList;
window.renderGanttList = renderGanttList;
window.switchGanttFilter = switchGanttFilter;
window.tempEditGanttWriter = tempEditGanttWriter;
window.toggleGanttCompleted = toggleGanttCompleted;
window.loadGanttDoc = loadGanttDoc;
window.deleteGantt = deleteGantt;
window.setGanttEditMode = setGanttEditMode;
