// 全局变量
let currentEvents = [];
let currentStatus = 'active';
let currentView = 'list'; // 'list' 或 'calendar'
let currentCalendarDate = new Date(); // 当前显示的日历月份
let currentCalendarStyle = 'waterfall'; // 'normal' 或 'waterfall' 日历显示样式
let waterfallMonthsSpan = 4; // 瀑布流日历显示的月份跨度（从今天开始向后显示的月数）
let messageDisplayTime = 800; // 提示信息显示时间（毫秒）
let quickAddEnabled = false; // 快速添加事件开关状态
let quickAddSwitch; // 快速添加开关DOM元素
// 使用单个字典变量管理所有通知设置
let notificationSettings = {
    enabled: true, // 全局开关
    categories: {
        action: true, // 操作提示类别
        system: true, // 系统消息类别
        error: true   // 错误消息类别
    }
};

// DOM元素
const eventsContainer = document.getElementById('events-container');
const emptyState = document.getElementById('empty-state');
const addEventBtn = document.getElementById('add-event-btn');
const eventModal = document.getElementById('event-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEventBtn = document.getElementById('cancel-event-btn');
const eventForm = document.getElementById('event-form');
const modalTitle = document.getElementById('modal-title');
const eventIdInput = document.getElementById('event-id');
const eventTitleInput = document.getElementById('event-title');
const eventDescriptionInput = document.getElementById('event-description');
const eventDueAtInput = document.getElementById('event-due-at');
const eventPriorityInput = document.getElementById('event-priority');
const statusFilterBtns = document.querySelectorAll('.status-filter-btn');
const searchInput = document.getElementById('search-input');
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toast-icon');
const toastMessage = document.getElementById('toast-message');
// 确认弹窗相关元素
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
// 详情弹窗元素
const eventDetailModal = document.getElementById('event-detail-modal');
const detailCloseBtn = document.getElementById('detail-close-btn');
const detailEditBtn = document.getElementById('detail-edit-btn');
const detailCompleteBtn = document.getElementById('detail-complete-btn');
const detailDeleteBtn = document.getElementById('detail-delete-btn');
const detailModalTitle = document.getElementById('detail-modal-title');
const eventDetailContent = document.getElementById('event-detail-content');
// 日历视图相关元素
const calendarContainer = document.getElementById('calendar-container');
const calendarCurrentMonth = document.getElementById('calendar-current-month');
const prevMonthBtn = document.getElementById('prev-month-btn');
const todayBtn = document.getElementById('today-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const calendarWeekdays = document.getElementById('calendar-weekdays');
const calendarGrid = document.getElementById('calendar-grid');
const listViewBtn = document.getElementById('list-view-btn');
const calendarViewBtn = document.getElementById('calendar-view-btn');
// 日历样式切换相关元素
const calendarStyleBtn = document.getElementById('calendar-style-btn');
const calendarStyleDropdown = document.getElementById('calendar-style-dropdown');
const waterfallViewBtn = document.getElementById('waterfall-view-btn');
const normalViewBtn = document.getElementById('normal-view-btn');
// 确认弹窗回调函数
let confirmCallback = null;

// 显示确认弹窗
function showConfirmModal(title, message, callback) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.remove('hidden');
}

// 隐藏确认弹窗
function hideConfirmModal() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
}

// 显示事件详情弹窗
async function showEventDetail(eventId) {
    try {
        // 获取事件详情
        const response = await fetch(`/api/v1/events/${eventId}`);
        if (!response.ok) throw new Error('Failed to fetch event');
        
        const event = await response.json();
        
        // 填充详情内容
        const now = new Date();
        const dueAt = new Date(event.due_at);
        const createdAt = new Date(event.created_at);
        
        // 获取事件动作历史
        const actionsResponse = await fetch(`/api/v1/events/${eventId}/actions`);
        const actions = await actionsResponse.json();
        
        let timeLeftText = '';
        let displayClass = '';
        
        if (event.status === 'completed') {
            // 已完成事件：计算完成时间在创建时间和截止时间之间的百分比
            const completeAction = actions.find(action => action.action_type === 'complete');
            if (completeAction) {
                const completeTime = new Date(completeAction.action_time);
                const totalDuration = dueAt - createdAt;
                const timeToComplete = completeTime - createdAt;
                const completionPercentage = Math.round((timeToComplete / totalDuration) * 100);
                timeLeftText = `完成于计划时间的 ${completionPercentage}%`;
                displayClass = 'bg-green-100 text-green-800';
            } else {
                timeLeftText = '已完成';
                displayClass = 'bg-green-100 text-green-800';
            }
        } else {
            // 未完成事件：显示剩余时间
            const urgencyClass = getUrgencyClass(dueAt, now, event.status);
            timeLeftText = calculateTimeLeft(dueAt, now);
            displayClass = getUrgencyColorClass(urgencyClass);
        }
        
        const priorityText = event.priority === 1 ? '高' : event.priority === 2 ? '中' : '低';
        const priorityBgClass = event.priority === 1 ? 'bg-red-500' : event.priority === 2 ? 'bg-yellow-500' : 'bg-green-500';
        const priorityTextClass = event.priority === 1 ? 'text-white' : event.priority === 2 ? 'text-white' : 'text-white';
        // 判断是否过期
        const isOverdue = event.status === 'active' && dueAt < now;
        const statusText = isOverdue ? '已过期' : (event.status === 'active' ? '正在进行' : '已完成');
        const statusBgClass = isOverdue ? 'bg-slate-100' : (event.status === 'active' ? 'bg-yellow-100' : 'bg-slate-100');
        const statusTextClass = isOverdue ? 'text-slate-800' : (event.status === 'active' ? 'text-yellow-800' : 'text-slate-800');
        
        eventDetailContent.innerHTML = `
            <div class="p-3 rounded-lg ${displayClass} text-sm font-medium mb-4">
                ${timeLeftText}
            </div>
            <div>
                <h4 class="text-sm font-medium text-gray-500 mb-1">标题</h4>
                <p class="text-lg font-semibold text-gray-800">${event.title}</p>
            </div>
            ${event.description ? `
            <div>
                <h4 class="text-sm font-medium text-gray-500 mb-1">描述</h4>
                <p class="text-gray-700 whitespace-pre-line">${event.description}</p>
            </div>
            ` : ''}
            <div class="grid grid-cols-2 gap-4">
                <!-- 左边列：截止时间和创建时间 -->
                <div>
                    <h4 class="text-sm font-medium text-gray-500 mb-1">截止时间</h4>
                    <p class="text-gray-700">${formatDate(dueAt)}</p>
                </div>
                <!-- 右边列：优先级 -->
                <div>
                    <h4 class="text-sm font-medium text-gray-500 mb-1">优先级</h4>
                    <span class="px-2 py-1 rounded-full ${priorityBgClass} ${priorityTextClass} text-sm">${priorityText}</span>
                </div>
                <!-- 左边列：创建时间 -->
                <div>
                    <h4 class="text-sm font-medium text-gray-500 mb-1">创建时间</h4>
                    <p class="text-gray-700">${formatDate(new Date(event.created_at))}</p>
                </div>
                <!-- 右边列：状态 -->
                <div>
                    <h4 class="text-sm font-medium text-gray-500 mb-1">状态</h4>
                    <span class="px-2 py-1 rounded-full ${statusBgClass} ${statusTextClass} text-xs">${statusText}</span>
                </div>
            </div>
            
            <!-- 操作历史 -->
            <div class="mt-6">
                <h4 class="text-sm font-medium text-gray-500 mb-3">操作历史</h4>
                <div class="bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto text-sm">
                    ${actions.length > 0 ? 
                        actions.map(action => {
                            const actionText = action.action_type === 'complete' ? '完成' : '重新打开';
                            const comment = action.comment ? ` - ${action.comment}` : '';
                            return `<div class="mb-3 pb-2 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                                <div class="flex justify-between items-center">
                                    <span class="font-medium">${actionText}</span>
                                    <span class="text-xs text-gray-500">${formatDate(new Date(action.action_time))}</span>
                                </div>
                                <div class="text-sm text-gray-600 mt-1">${comment}</div>
                            </div>`;
                        }).join('') : 
                        '<div class="text-gray-500 text-center py-4">暂无操作记录</div>'
                    }
                </div>
            </div>
        `;
        
        // 保存当前事件ID，用于按钮操作
        detailEditBtn.dataset.eventId = eventId;
        detailCompleteBtn.dataset.eventId = eventId;
        detailDeleteBtn.dataset.eventId = eventId;
        
        // 根据事件状态显示不同按钮
        const isDetailOverdue = event.status === 'active' && new Date(event.due_at) < new Date();
        if (event.status === 'active') {
            // 活跃事件显示完成/补完成按钮
            if (isDetailOverdue) {
                // 过期事件显示为补完成按钮
                detailCompleteBtn.classList.remove('hidden');
                detailCompleteBtn.textContent = '补完成';
                detailCompleteBtn.className = 'px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors';
            } else {
                // 正常事件显示为完成按钮
                detailCompleteBtn.classList.remove('hidden');
                detailCompleteBtn.textContent = '完成';
                detailCompleteBtn.className = 'px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors';
            }
        } else if (event.status === 'completed') {
            // 已完成事件不显示操作按钮和编辑按钮
            detailCompleteBtn.classList.add('hidden');
            detailEditBtn.classList.add('hidden');
        } else {
            detailCompleteBtn.classList.add('hidden');
        }
        
        // 显示弹窗
        eventDetailModal.classList.remove('hidden');
    } catch (error) {
        showToast('加载事件详情失败', 'error');
        console.error('Error loading event detail:', error);
    }
}

// 关闭详情弹窗
function closeDetailModal() {
    eventDetailModal.classList.add('hidden');
}

// 初始化
function init() {
    // 设置默认日期时间为当前时间+1小时
    const defaultDateTime = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
    eventDueAtInput.value = defaultDateTime;
    
    // 初始化快速添加开关
    quickAddSwitch = document.getElementById('quick-add-switch');
    if (quickAddSwitch) {
        quickAddSwitch.addEventListener('change', (e) => {
            quickAddEnabled = e.target.checked;
            // 添加操作提示
            showActionToast(quickAddEnabled ? '开启快速添加' : '关闭快速添加');
            // 当快速添加状态改变时，重新渲染日历以更新事件项的样式和可点击状态
            if (currentView === 'calendar') {
                if (currentCalendarStyle === 'waterfall') {
                    renderWaterfallCalendar();
                } else {
                    renderCalendar();
                }
            }
        });
    }
    
    // 初始化操作提示开关
    const notificationToggle = document.getElementById('notification-toggle');
    if (notificationToggle) {
        // 设置初始状态
        notificationToggle.checked = notificationSettings.enabled;
        
        // 添加事件监听器
        notificationToggle.addEventListener('change', (e) => {
            toggleNotifications(e.target.checked);
        });
    }
    
    // 初始化日历
    initCalendar();
    
    // 初始设置为瀑布流视图
    currentCalendarStyle = 'waterfall';
    
    // 加载事件
    loadEvents();
    
    // 绑定事件监听
    addEventBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelEventBtn.addEventListener('click', closeModal);
    eventForm.addEventListener('submit', handleFormSubmit);
    
    // 状态过滤器
    statusFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            if (status !== currentStatus) {
                currentStatus = status;
                updateFilterButtons();
                loadEvents();
                // 添加操作提示
                const statusText = status === 'all' ? '全部' : status === 'active' ? '活跃' : '已完成';
                showActionToast(`筛选${statusText}事件`);
            }
        });
    });
    
    // 视图切换按钮
    listViewBtn.addEventListener('click', () => {
        if (currentView !== 'list') {
            currentView = 'list';
            updateViewButtons();
            toggleView();
            // 添加操作提示
            showActionToast('切换到列表视图');
        }
    });
    
    calendarViewBtn.addEventListener('click', () => {
        if (currentView !== 'calendar') {
            currentView = 'calendar';
            updateViewButtons();
            toggleView();
            // 添加操作提示
            showActionToast('切换到日历视图');
        }
    });
    
    // 日历导航按钮
    prevMonthBtn.addEventListener('click', () => {
        // 只有在普通模式下才切换月份
        if (currentCalendarStyle === 'normal') {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
            // 添加操作提示
            showActionToast('切换到上个月');
        }
    });
    
    nextMonthBtn.addEventListener('click', () => {
        // 只有在普通模式下才切换月份
        if (currentCalendarStyle === 'normal') {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
            // 添加操作提示
            showActionToast('切换到下个月');
        }
    });
    
    todayBtn.addEventListener('click', () => {
        currentCalendarDate = new Date();
        // 根据当前样式渲染
        if (currentCalendarStyle === 'waterfall') {
            renderWaterfallCalendar();
            // 滚动到今天
            scrollToToday();
        } else {
            renderCalendar();
        }
        // 添加操作提示
        showActionToast('返回今天');
    });
    
    // 日历样式切换按钮事件
    calendarStyleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        calendarStyleDropdown.classList.toggle('hidden');
    });
    
    // 瀑布流模式按钮
    waterfallViewBtn.addEventListener('click', () => {
        currentCalendarStyle = 'waterfall';
        if (currentView === 'calendar') {
            renderWaterfallCalendar();
        }
        calendarStyleDropdown.classList.add('hidden');
        // 添加操作提示
        showActionToast('切换到瀑布流模式');
    });
    
    // 普通模式按钮
    normalViewBtn.addEventListener('click', () => {
        currentCalendarStyle = 'normal';
        if (currentView === 'calendar') {
            renderCalendar();
        }
        calendarStyleDropdown.classList.add('hidden');
        // 添加操作提示
        showActionToast('切换到普通模式');
    });
    
    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        calendarStyleDropdown.classList.add('hidden');
    });
    
    // 阻止下拉菜单内的点击事件冒泡
    calendarStyleDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 阻止样式按钮的点击事件冒泡
    calendarStyleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 点击模态框外部关闭
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) {
            closeModal();
        }
    });
    
    // 搜索功能
    searchInput.addEventListener('input', () => {
        handleSearch();
    });
    
    // 确认弹窗事件绑定
    confirmCancelBtn.addEventListener('click', () => {
        hideConfirmModal();
    });
    
    confirmOkBtn.addEventListener('click', () => {
        if (typeof confirmCallback === 'function') {
            confirmCallback(true);
        }
        hideConfirmModal();
    });
    
    // 点击确认弹窗外部关闭
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            hideConfirmModal();
        }
    });
    
    // 绑定详情弹窗按钮事件
    detailCloseBtn.addEventListener('click', closeDetailModal);
    detailEditBtn.addEventListener('click', () => {
        const eventId = detailEditBtn.dataset.eventId;
        closeDetailModal();
        openEditModal(eventId);
    });
    
    // 绑定完成按钮事件
    detailCompleteBtn.addEventListener('click', () => {
        const eventId = detailCompleteBtn.dataset.eventId;
        const buttonText = detailCompleteBtn.textContent;
        
        if (buttonText === '重新打开') {
            // 调用重新打开事件函数
            reopenEvent(parseInt(eventId));
        } else {
            // 判断是否是补完成操作
            const isMakeup = buttonText === '补完成';
            // 调用完成事件函数
            completeEvent(parseInt(eventId), isMakeup);
        }
        // 关闭详情弹窗
        closeDetailModal();
    });
    
    // 绑定删除按钮事件
    detailDeleteBtn.addEventListener('click', () => {
        const eventId = detailDeleteBtn.dataset.eventId;
        // 调用删除事件函数
        deleteEvent(parseInt(eventId));
        // 关闭详情弹窗
        closeDetailModal();
    });
    
    // 点击弹窗背景关闭弹窗
    eventDetailModal.addEventListener('click', (e) => {
        if (e.target === eventDetailModal) {
            closeDetailModal();
        }
    });
}

// 加载事件
async function loadEvents() {
    try {
        const response = await fetch(`/api/v1/events?status=${currentStatus}`);
        if (!response.ok) throw new Error('Failed to load events');
        
        currentEvents = await response.json();
        
        // 根据当前视图渲染
        if (currentView === 'list') {
            renderEvents();
        } else {
            // 根据当前选择的样式渲染日历
            if (currentCalendarStyle === 'waterfall') {
                renderWaterfallCalendar();
            } else {
                renderCalendar();
            }
        }
    } catch (error) {
        showToast('加载事件失败', 'error');
        console.error('Error loading events:', error);
    }
}

// 切换视图显示
function toggleView() {
    if (currentView === 'list') {
        calendarContainer.classList.add('hidden');
        eventsContainer.classList.remove('hidden');
        // 在列表视图时隐藏样式按钮和快速添加开关
        document.getElementById('calendar-style-floating').classList.add('hidden');
        document.getElementById('quick-add-toggle').classList.add('hidden');
        // 如果有搜索过滤或状态过滤，需要重新渲染列表
        handleSearch();
    } else {
        eventsContainer.classList.add('hidden');
        calendarContainer.classList.remove('hidden');
        // 在日历视图时显示样式按钮和快速添加开关
        document.getElementById('calendar-style-floating').classList.remove('hidden');
        document.getElementById('quick-add-toggle').classList.remove('hidden');
        // 根据当前选择的样式渲染日历
        if (currentCalendarStyle === 'waterfall') {
            renderWaterfallCalendar();
        } else {
            renderCalendar();
        }
    }
}

// 更新视图切换按钮状态
function updateViewButtons() {
    if (currentView === 'list') {
        listViewBtn.classList.add('text-primary', 'border-primary');
        listViewBtn.classList.remove('text-gray-700', 'border-gray-300');
        calendarViewBtn.classList.remove('text-primary', 'border-primary');
        calendarViewBtn.classList.add('text-gray-700', 'border-gray-300');
    } else {
        calendarViewBtn.classList.add('text-primary', 'border-primary');
        calendarViewBtn.classList.remove('text-gray-700', 'border-gray-300');
        listViewBtn.classList.remove('text-primary', 'border-primary');
        listViewBtn.classList.add('text-gray-700', 'border-gray-300');
    }
}

// 初始化日历
function initCalendar() {
    // 渲染星期标题
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    calendarWeekdays.innerHTML = '';
    
    weekdays.forEach((day, index) => {
        const weekdayEl = document.createElement('div');
        // 周日和周六使用不同的颜色
        if (index === 0 || index === 6) {
            weekdayEl.className = 'p-2 text-center text-gray-500';
        } else {
            weekdayEl.className = 'p-2 text-center';
        }
        weekdayEl.textContent = `星期${day}`; // 显示完整的星期
        calendarWeekdays.appendChild(weekdayEl);
    });
}

// 渲染瀑布流日历
function renderWaterfallCalendar() {
    // 更新月份标题为范围显示
    calendarCurrentMonth.textContent = '日历视图（瀑布流模式）';
    
    // 隐藏今天按钮和左右箭头
    todayBtn.classList.add('hidden');
    prevMonthBtn.classList.add('hidden');
    nextMonthBtn.classList.add('hidden');
    
    // 清空日历格子
    calendarGrid.innerHTML = '';
    
    // 设置日历头部在瀑布流模式下固定在顶部
    const calendarHeader = document.querySelector('#calendar-container > div:first-child');
    if (calendarHeader) {
        calendarHeader.style.position = 'sticky';
        calendarHeader.style.top = '0';
        calendarHeader.style.zIndex = '10';
        calendarHeader.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        calendarHeader.style.backdropFilter = 'blur(30px)';
    }
    
    // 设置星期标题行也固定在顶部，在日历头部下方
    const calendarWeekdays = document.getElementById('calendar-weekdays');
    if (calendarWeekdays) {
        calendarWeekdays.style.position = 'sticky';
        calendarWeekdays.style.top = '30px'; // 保持在日历标题容器下方
        calendarWeekdays.style.zIndex = '20'; // 提高层级，确保在月份分隔符上方
        calendarWeekdays.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        calendarWeekdays.style.backdropFilter = 'blur(30px)';
    }
    
    // 设置日历容器为固定高度和可滚动样式，确保内容在容器内滚动而不是页面滚动，同时隐藏滚动条
    calendarGrid.className = 'grid grid-cols-7 gap-2 overflow-y-auto max-h-[440px] scrollbar-hide'; // 减少最大高度以适应固定头部
    
    // 添加滚动事件监听器，实现日期单元格靠近月份标题时的透明度渐变效果
    setupCellOpacityObserver();
    
    // 获取当前日期
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();
    
    // 计算起始日期（今天）
    const startDate = new Date(currentYear, currentMonth, currentDate);
    // 计算结束日期（从今天开始向后waterfallMonthsSpan个月）
    const endDate = new Date(currentYear, currentMonth + waterfallMonthsSpan + 1, 0);
    
    // 计算起始日期是星期几
    const startDayOfWeek = startDate.getDay();
    
    // 从起始日期的前一个星期日开始
    const displayStartDate = new Date(startDate);
    displayStartDate.setDate(startDate.getDate() - startDayOfWeek);
    
    // 从结束日期的下一个星期六结束
    const displayEndDate = new Date(endDate);
    displayEndDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    // 创建日期单元格
    let currentDateObj = new Date(displayStartDate);
    
    // 为每个日期创建单元格
    while (currentDateObj <= displayEndDate) {
        const year = currentDateObj.getFullYear();
        const month = currentDateObj.getMonth();
        const date = currentDateObj.getDate();
        
        // 判断是否是今天
        const isToday = year === today.getFullYear() && 
                        month === today.getMonth() && 
                        date === today.getDate();
        
        // 获取当天的事件
        const dayEvents = getEventsForDate(year, month + 1, date);
        
        // 创建日期单元格
        const cell = createCalendarDayCell(date, dayEvents, false, isToday, year, month + 1, quickAddEnabled);
        
        // 为每个月的第一天添加月份标签
        if (date === 1) {
            // 先添加一个渐变遮罩层
            const maskDiv = document.createElement('div');
            maskDiv.className = 'col-span-7 h-[40px] bg-gradient-to-b from-transparent to-white sticky top-[-40px] z-[16] pointer-events-none';
            calendarGrid.appendChild(maskDiv);
            
            // 添加月份分隔符 - 放在星期日列的正上方
            const monthDivider = document.createElement('div');
            // 设置为与日期单元格相同的宽度，显示在星期日列上方，确保不换行
            // 增强毛玻璃效果，降低背景不透明度，增加模糊半径和边框
            monthDivider.className = 'col-span-1 p-1 bg-white/50 backdrop-blur-[150px] border border-white/70 rounded-lg mb-1 sticky top-[-10px] z-50 shadow-md text-center font-medium whitespace-nowrap';
            monthDivider.textContent = `${year}年${month + 1}月`;
            monthDivider.dataset.year = year;
            monthDivider.dataset.month = month + 1;
            
            // 直接添加月份分隔符到网格中
            calendarGrid.appendChild(monthDivider);
            
            // 添加6个空白单元格来完成第一行
            for (let i = 0; i < 6; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'col-span-1';
                calendarGrid.appendChild(emptyCell);
            }
    }
    
    // 为每个单元格添加标识类和数据属性，方便观察器识别和计算
    cell.classList.add('calendar-day-cell');
    cell.dataset.year = year;
    cell.dataset.month = month + 1;
    cell.dataset.date = date;
    calendarGrid.appendChild(cell);
        
        // 移动到下一天
        currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
}

// 滚动到今天
function scrollToToday() {
    // 等待DOM更新
    setTimeout(() => {
        const todayCell = document.querySelector('.bg-primary/5');
        if (todayCell) {
            todayCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

// 获取指定日期的事件
function getEventsForDate(year, month, date) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return currentEvents.filter(event => {
        const eventDate = new Date(event.due_at).toISOString().split('T')[0];
        return eventDate === dateStr;
    });
}

// 渲染日历
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 显示今天按钮和左右箭头
    todayBtn.classList.remove('hidden');
    prevMonthBtn.classList.remove('hidden');
    nextMonthBtn.classList.remove('hidden');
    
    // 重置日历头部样式，恢复为普通模式
    const calendarHeader = document.querySelector('#calendar-container > div:first-child');
    if (calendarHeader) {
        calendarHeader.style.position = 'static';
        calendarHeader.style.top = 'auto';
        calendarHeader.style.zIndex = 'auto';
        calendarHeader.style.backgroundColor = 'transparent';
    }
    
    // 重置星期标题行样式
    const calendarWeekdays = document.getElementById('calendar-weekdays');
    if (calendarWeekdays) {
        calendarWeekdays.style.position = 'static';
        calendarWeekdays.style.top = 'auto';
        calendarWeekdays.style.zIndex = 'auto';
        calendarWeekdays.style.backgroundColor = 'transparent';
    }
    
    // 重置日历容器样式
    calendarGrid.className = 'grid grid-cols-7 gap-2';
    
    // 更新月份标题
    calendarCurrentMonth.textContent = `${year}年${month + 1}月`;
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 获取当月第一天是星期几
    const firstDayOfWeek = firstDay.getDay();
    
    // 计算需要显示的总天数（包含上个月和下个月的部分日期）
    const daysInMonth = lastDay.getDate();
    
    // 清空日历格子
    calendarGrid.innerHTML = '';
    
    // 获取当月的事件，按日期分组
    const monthlyEvents = groupEventsByDate(currentEvents, year, month);
    
    // 添加上个月的日期
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const normalizedPreviousMonth = month - 1 < 0 ? 11 : month - 1;
    const previousMonthYear = month - 1 < 0 ? year - 1 : year;
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const dateStr = `${previousMonthYear}-${String(normalizedPreviousMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = monthlyEvents[dateStr] || [];
        
        const dayCell = createCalendarDayCell(day, dayEvents, true, false, previousMonthYear, normalizedPreviousMonth + 1, quickAddEnabled);
        calendarGrid.appendChild(dayCell);
    }
    
    // 添加当月的日期
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = monthlyEvents[dateStr] || [];
        const isToday = isCurrentMonth && today.getDate() === day;
        
        const dayCell = createCalendarDayCell(day, dayEvents, false, isToday, year, month + 1, quickAddEnabled);
        calendarGrid.appendChild(dayCell);
    }
    
    // 添加下个月的日期，补齐到42个格子（6行7列）
    const remainingDays = 42 - (firstDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingDays; day++) {
        const nextMonth = month + 1;
        const nextMonthYear = nextMonth > 11 ? year + 1 : year;
        const normalizedNextMonth = nextMonth > 11 ? 0 : nextMonth;
        const dateStr = `${nextMonthYear}-${String(normalizedNextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = monthlyEvents[dateStr] || [];
        
        const dayCell = createCalendarDayCell(day, dayEvents, true, false, nextMonthYear, normalizedNextMonth + 1, quickAddEnabled);
        calendarGrid.appendChild(dayCell);
    }
}

// 创建日历日期格子
function createCalendarDayCell(day, events, isOtherMonth, isToday = false, year, month, quickAddEnabled = false) {
    const cell = document.createElement('div');
    
    // 设置基本样式 - 更现代的外观
    cell.className = 'min-h-[120px] border border-gray-200 rounded-lg p-2 transition-all duration-200 hover:shadow-md cursor-pointer relative';
    
    // 创建日期和徽章容器
    const headerContainer = document.createElement('div');
    headerContainer.className = 'flex justify-between items-center mb-1';
    
    // 添加日期数字 - 调整位置避免遮挡
    const dayNumber = document.createElement('div');
    dayNumber.className = 'text-sm font-medium';
    
    // 根据是否是其他月份或今天设置不同样式
    if (isOtherMonth) {
        dayNumber.className += ' text-gray-400';
        cell.classList.add('opacity-60');
    } else if (isToday) {
        // 今天的日期使用标准样式
        dayNumber.className += ' text-gray-800';
        
        // 根据模式设置不同的颜色效果
        if (quickAddEnabled) {
            // 快速添加模式：使用深灰色调，保持一定辨识度但显示为不可编辑状态
            cell.classList.add('bg-gray-200', 'border-gray-300', 'shadow-sm');
        } else {
            // 正常模式：使用主题色强调
            cell.classList.add('bg-gradient-to-br', 'from-primary/20', 'to-primary/35', 'border-primary', 'shadow-md');
        }
    } else {
        // 确保非今天的日期不会错误地应用今天的样式
        dayNumber.className += ' text-gray-800';
    }
    
    dayNumber.textContent = day;
    headerContainer.appendChild(dayNumber);
    
    // 根据事件数量设置背景色和样式
    if (!isOtherMonth && events.length > 0) {
        // 更柔和的背景色方案
        let bgClass = '';
        
        // 快速添加模式下使用灰色调背景
        if (quickAddEnabled) {
            bgClass = 'bg-gray-100';
        } else {
            // 正常模式下使用蓝色调背景
            if (events.length === 1) {
                bgClass = 'bg-blue-50';
            } else if (events.length === 2) {
                bgClass = 'bg-blue-100/70';
            } else if (events.length >= 3) {
                bgClass = 'bg-blue-100';
            }
        }
        
        cell.classList.add(bgClass);
        
        // 事件数量指示器 - 放在日期旁边而不是绝对定位
        const badge = document.createElement('div');
        
        // 快速添加模式下，事件数量也显示为灰色
        if (quickAddEnabled) {
            badge.className = 'bg-gray-400 text-gray-600 text-xs rounded-full w-5 h-5 flex items-center justify-center';
        } else {
            badge.className = 'bg-primary/80 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center';
        }
        
        badge.textContent = events.length > 9 ? '9+' : events.length;
        headerContainer.appendChild(badge);
    }
    
    cell.appendChild(headerContainer);
    
    // 添加事件标题列表
    const eventsList = document.createElement('div');
    eventsList.className = 'text-xs overflow-hidden mt-1';
        
        // 最多显示3个事件标题
        const displayEvents = events.slice(0, 3);
        displayEvents.forEach(event => {
            const eventItem = document.createElement('div');
            
            // 基础样式
            let baseClass = 'mb-1.5 line-clamp-1 px-2 py-1 rounded bg-white/80 shadow-sm';
            
            // 快速添加模式下，事件灰色显示且不可点击
            if (quickAddEnabled) {
                baseClass += ' text-gray-400 cursor-default';
            } else {
                baseClass += ' cursor-pointer transition-colors hover:bg-white';
            }
            
            eventItem.className = baseClass;
            
            // 根据事件状态设置不同颜色
            if (!quickAddEnabled) { // 快速添加模式下忽略其他状态颜色
                if (event.status === 'completed') {
                    eventItem.className += ' text-gray-500 line-through';
                } else if (new Date(event.due_at) < new Date()) {
                    eventItem.className += ' text-red-600 font-medium';
                } else {
                    eventItem.className += ' text-gray-800';
                }
                
                // 根据优先级设置不同的左边框
                if (event.priority) {
                    const priority = parseInt(event.priority);
                    if (priority === 1) {
                        eventItem.style.borderLeft = '3px solid #EF4444'; // 高优先级 - 红色
                    } else if (priority === 2) {
                        eventItem.style.borderLeft = '3px solid #F59E0B'; // 中优先级 - 黄色
                    } else if (priority === 3) {
                        eventItem.style.borderLeft = '3px solid #10B981'; // 低优先级 - 绿色
                    }
                }
            } else {
                // 快速添加模式下，统一设置为灰色边框
                eventItem.style.borderLeft = '3px solid #9CA3AF';
            }
            
            eventItem.textContent = event.title;
            
            // 只有在非快速添加模式下才添加点击事件
            if (!quickAddEnabled) {
                // 阻止事件冒泡，确保点击单个事件时不会触发日期格子的点击事件
                eventItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showEventDetail(event.id);
                });
            }
            
            eventsList.appendChild(eventItem);
        });
        
        // 如果事件超过3个，显示省略号
        if (events.length > 3) {
            const moreEl = document.createElement('div');
            
            // 快速添加模式下，显示为灰色且不可点击
            if (quickAddEnabled) {
                moreEl.className = 'text-gray-400 text-xs italic mt-1 text-center cursor-default';
            } else {
                moreEl.className = 'text-primary text-xs italic mt-1 text-center cursor-pointer hover:underline';
                // 只有在非快速添加模式下才添加点击事件
                moreEl.addEventListener('click', (e) => {
                    e.stopPropagation(); // 先阻止冒泡
                    showDayEvents(day, events); // 然后显示弹窗
                });
            }
            
            moreEl.textContent = `还有 ${events.length - 3} 个事件...`;
            eventsList.appendChild(moreEl);
        }
        
        cell.appendChild(eventsList);
    
    // 为日历格子添加点击事件
    if (!isOtherMonth) {
        cell.addEventListener('click', async () => {
            // 输出点击的日期到控制台
            console.log('点击的日期:', year, '年', month, '月', day, '日');
            
            // 如果快速添加功能开启，直接打开新增事件弹窗并设置日期
            if (quickAddEnabled) {
                // 修复月份计算错误 - 直接使用正确的月份，不再加1
                openAddModalForDate(year, month, day);
                return;
            }
            
            // 原有的点击行为
            if (events.length > 0) {
                showDayEvents(day, events);
            } else {
                // 当天没有事件时，调用getLine接口
                try {
                    const response = await fetch('/api/v1/getLine');
                    if (response.ok) {
                        const data = await response.json();
                        showTemporaryMessage(data.text);
                    }
                } catch (error) {
                    console.error('获取提示信息失败:', error);
                }
            }
        });
    }
    
    return cell;
}

// 移除之前的透明度调整函数，使用CSS渐变遮罩层代替
function setupCellOpacityObserver() {
    // 移除之前可能添加的滚动事件监听器，避免重复添加
    if (window.cellOpacityScrollHandler) {
        calendarGrid.removeEventListener('scroll', window.cellOpacityScrollHandler);
        window.cellOpacityScrollHandler = null;
    }
    
    // 重置所有单元格的透明度
    const allCells = document.querySelectorAll('.calendar-day-cell');
    allCells.forEach(cell => {
        cell.style.opacity = '1';
    });
    
    // 现在使用CSS渐变遮罩层来处理透明度，不再需要JavaScript事件监听
}

// 显示临时提示信息并自动消失 - 采用底部弹出样式，使用全局变量控制显示时间
function showTemporaryMessage(message, displayTime = messageDisplayTime) { // 使用全局变量作为默认值
    // 检查是否已存在提示元素，避免重复创建
    let messageElement = document.getElementById('temporary-message');
    if (messageElement) {
        // 如果已存在，先让它平滑消失再移除
        messageElement.style.transition = 'all 0.3s ease-out';
        messageElement.style.transform = 'translate(-50%, 20px)';
        messageElement.style.opacity = '0';
        setTimeout(() => {
            if (messageElement.parentNode) {
                document.body.removeChild(messageElement);
            }
        }, 300);
        // 短暂延迟确保旧消息开始消失后再创建新消息
        setTimeout(() => createNewMessage(message, displayTime), 150);
        return;
    }
    
    createNewMessage(message, displayTime);
}

function createNewMessage(message, displayTime) {
    // 创建新的提示元素 - 底部弹出样式，改进动画效果
    const messageElement = document.createElement('div');
    messageElement.id = 'temporary-message';
    messageElement.className = 'fixed bottom-5 left-1/2 transform -translate-x-1/2 translate-y-20 bg-success text-white py-4 px-8 z-50 shadow-lg rounded-lg flex items-center justify-center text-xl font-semibold max-w-md mx-4';
    
    // 设置初始状态和过渡
    messageElement.style.opacity = '0';
    messageElement.style.transition = 'all 0.3s ease-out';
    
    // 添加图标
    const icon = document.createElement('i');
    icon.className = 'fa fa-check-circle mr-3 text-2xl';
    messageElement.appendChild(icon);
    
    // 添加消息文本
    const textNode = document.createTextNode(message);
    messageElement.appendChild(textNode);
    
    // 添加到页面
    document.body.appendChild(messageElement);
    
    // 使用requestAnimationFrame确保动画流畅
    requestAnimationFrame(() => {
        // 强制重绘以确保CSS过渡生效
        void messageElement.offsetWidth;
        // 触发滑入动画
        messageElement.style.transform = 'translate(-50%, 0)';
        messageElement.style.opacity = '1';
    });
    
    // 根据传入时间或全局变量自动隐藏（滑出动画）
    setTimeout(() => {
        // 确保动画平滑结束
        requestAnimationFrame(() => {
            // 触发滑出动画
            messageElement.style.transform = 'translate(-50%, 20px)';
            messageElement.style.opacity = '0';
            // 确保等待动画完全结束后再移除元素
            setTimeout(() => {
                if (messageElement.parentNode) {
                    document.body.removeChild(messageElement);
                }
            }, 300); // 与transition-duration匹配
        });
    }, displayTime);
}

// 显示某天的所有事件
function showDayEvents(day, events) {
    // 获取当前显示的年月
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    
    // 格式化日期
    const dateStr = `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`;
    
    // 创建并显示模态框 - 设置较低的z-index，确保事件详情弹窗能显示在上面
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-40';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-xl font-bold text-gray-800">${dateStr} 的事件 (${events.length}个)</h3>
                <button id="close-day-events-btn" class="text-gray-500 hover:text-gray-700 focus:outline-none">
                    <i class="fa fa-times text-xl"></i>
                </button>
            </div>
            <div class="p-6 overflow-y-auto">
                ${events.length === 0 ? 
                    '<div class="text-center py-10 text-gray-500">当天没有事件</div>' : 
                    events
                        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
                        .map(event => {
                            const isOverdue = event.status !== 'completed' && new Date(event.due_at) < new Date();
                            const priority = parseInt(event.priority);
                            let priorityClass = '';
                            if (priority === 1) priorityClass = 'border-l-4 border-red-500';
                            else if (priority === 2) priorityClass = 'border-l-4 border-yellow-500';
                            else if (priority === 3) priorityClass = 'border-l-4 border-green-500';
                            
                            return `
                                <div class="${priorityClass} bg-gray-50 rounded-lg p-4 mb-3 cursor-pointer hover:bg-gray-100 transition-colors">
                                    <div class="flex justify-between items-start">
                                        <h4 class="font-medium ${event.status === 'completed' ? 'text-gray-500 line-through' : isOverdue ? 'text-red-600' : 'text-gray-800'}">${event.title}</h4>
                                        <span class="text-xs ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} px-2 py-1 rounded-full">
                                            ${formatTime(event.due_at)}
                                        </span>
                                    </div>
                                    ${event.description ? `<p class="text-sm text-gray-600 mt-2">${event.description}</p>` : ''}
                                    <div class="flex justify-between items-center mt-3 text-xs text-gray-500">
                                        <span>${event.status === 'completed' ? '<i class="fa fa-check-circle mr-1"></i>已完成' : '<i class="fa fa-clock-o mr-1"></i>未完成'}</span>
                                        <span>${getPriorityText(priority)}</span>
                                    </div>
                                </div>
                            `;
                        })
                        .join('')
                }
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 关闭按钮事件
    document.getElementById('close-day-events-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // 为每个事件卡片添加点击事件
    const eventCards = modal.querySelectorAll('.bg-gray-50.rounded-lg');
    eventCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            // 直接显示事件详情，不再移除日期事件弹窗，使其成为第二级弹窗
            showEventDetail(events[index].id);
        });
    });
}

// 格式化时间
function formatTime(dateString) {
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 获取优先级文本
function getPriorityText(priority) {
    switch(priority) {
        case 1: return '高优先级';
        case 2: return '中优先级';
        case 3: return '低优先级';
        default: return '未设置优先级';
    }
}

// 按日期分组事件
function groupEventsByDate(events, targetYear, targetMonth) {
    const groupedEvents = {};
    
    events.forEach(event => {
        const eventDate = new Date(event.due_at);
        const year = eventDate.getFullYear();
        const month = eventDate.getMonth();
        const day = eventDate.getDate();
        
        // 只处理目标月份的事件，或者前后月份需要显示的事件
        if ((year === targetYear && (month === targetMonth || month === targetMonth - 1 || month === targetMonth + 1)) ||
            (year === targetYear - 1 && month === 11 && targetMonth === 0) ||
            (year === targetYear + 1 && month === 0 && targetMonth === 11)) {
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (!groupedEvents[dateStr]) {
                groupedEvents[dateStr] = [];
            }
            groupedEvents[dateStr].push(event);
        }
    });
    
    return groupedEvents;
}

// 渲染事件列表
function renderEvents(filteredEvents = null) {
    const events = filteredEvents || currentEvents;
    
    eventsContainer.innerHTML = '';
    
    if (events.length === 0) {
        eventsContainer.appendChild(emptyState);
        return;
    }
    
    // 改进排序逻辑：未过期事件按到期时间升序排列，过期事件排在最后
    const now = new Date();
    const sortedEvents = [...events].sort((a, b) => {
        const aDue = new Date(a.due_at);
        const bDue = new Date(b.due_at);
        
        // 检查是否过期
        const aIsOverdue = aDue < now;
        const bIsOverdue = bDue < now;
        
        // 如果一个过期一个未过期，未过期的排在前面
        if (aIsOverdue !== bIsOverdue) {
            return aIsOverdue ? 1 : -1;
        }
        
        // 都未过期或都已过期时，按到期时间升序排列
        return aDue - bDue;
    });
    
    sortedEvents.forEach(event => {
        const card = createEventCard(event);
        eventsContainer.appendChild(card);
    });
    
    // 如果当前是日历视图，也重新渲染日历
    if (currentView === 'calendar') {
        renderCalendar();
    }
}

// 创建事件卡片
function createEventCard(event) {
    const card = document.createElement('div');
    
    const now = new Date();
    const dueAt = new Date(event.due_at);
    const createdAt = new Date(event.created_at);
    const timeLeft = calculateTimeLeft(dueAt, now);
    const urgencyClass = getUrgencyClass(dueAt, now, event.status);
    const priorityText = ['', '高', '中', '低'][event.priority];
        const priorityBgClass = event.priority === 1 ? 'bg-red-500' : event.priority === 2 ? 'bg-yellow-500' : 'bg-green-500';
        const priorityTextClass = event.priority === 1 ? 'text-white' : event.priority === 2 ? 'text-white' : 'text-white';
    // 判断是否过期
    const isOverdue = event.status === 'active' && dueAt < now;
    
    // 计算进度百分比
    let progressPercentage = 0;
    if (event.status === 'active') {
        // 过期事件直接设置为100%
        if (isOverdue) {
            progressPercentage = 100;
            console.log('事件已过期，设置进度为100%');
        } else {
            const totalDuration = dueAt - createdAt;
            const elapsedTime = now - createdAt;
            
            // 输出调试信息到控制台
            console.log('事件进度计算调试:');
            console.log('事件ID:', event.id);
            console.log('事件标题:', event.title);
            console.log('创建时间:', createdAt.toISOString());
            console.log('截止时间:', dueAt.toISOString());
            console.log('当前时间:', now.toISOString());
            console.log('总时长(毫秒):', totalDuration);
            console.log('已用时间(毫秒):', elapsedTime);
            
            // 计算进度百分比，确保不会出现负数
            if (totalDuration !== 0) {
                // 如果已用时间为负数（当前时间早于创建时间），设置为0%
                if (elapsedTime < 0) {
                    progressPercentage = 0;
                    console.log('当前时间早于创建时间，设置进度为0%');
                } else {
                    progressPercentage = (elapsedTime / totalDuration) * 100;
                    console.log('直接计算进度百分比:', progressPercentage);
                }
            } else {
                progressPercentage = 0; // 避免除以零
                console.log('总时长为零，设置进度为0%');
            }
        }
        
        console.log('最终进度百分比:', progressPercentage);
    } else if (event.status === 'completed') {
        progressPercentage = 100; // 已完成的任务显示100%进度
        console.log('事件已完成，设置进度为100%');
    } else if (event.status === 'cancelled') {
        // 取消的任务显示50%进度作为视觉区分
        progressPercentage = 50;
        console.log('事件已取消，设置进度为50%');
    }
    
    const statusText = isOverdue ? '已过期' : {
        active: '正在进行',
        completed: '已完成',
        deleted: '已删除'
    }[event.status] || '未知';
    
    // 根据紧急度获取卡片背景色和文本颜色
    let cardBgClass, titleTextClass, descriptionTextClass, metaTextClass, separatorClass, statusBgClass, statusTextClass;
    
    if (event.status === 'completed') {
        // 已完成的事件使用深灰色系
        cardBgClass = 'bg-gray-100';
        titleTextClass = 'text-gray-700';
        descriptionTextClass = 'text-gray-600';
        metaTextClass = 'text-gray-500';
        separatorClass = 'border-gray-300';
        statusBgClass = isOverdue ? 'bg-slate-300' : 'bg-gray-300';
        statusTextClass = isOverdue ? 'text-slate-800' : 'text-gray-700';
    } else {
        // 如果任务已过期，使用蓝灰色系样式
        if (isOverdue) {
            cardBgClass = 'bg-slate-100';
            titleTextClass = 'text-slate-900';
            descriptionTextClass = 'text-slate-800';
            metaTextClass = 'text-slate-700';
            separatorClass = 'border-slate-200';
            statusBgClass = 'bg-slate-500';
            statusTextClass = 'text-white';
        } else {
            // 根据紧急程度设置不同色系（更深的色调）
            switch(urgencyClass) {
                case 'red-500':
                    cardBgClass = 'bg-red-100';
                    titleTextClass = 'text-red-900';
                    descriptionTextClass = 'text-red-800';
                    metaTextClass = 'text-red-700';
                    separatorClass = 'border-red-200';
                    statusBgClass = 'bg-red-200';
                    statusTextClass = 'text-red-800';
                    break;
                case 'yellow-500':
                    cardBgClass = 'bg-yellow-100';
                    titleTextClass = 'text-yellow-900';
                    descriptionTextClass = 'text-yellow-800';
                    metaTextClass = 'text-yellow-700';
                    separatorClass = 'border-yellow-200';
                    statusBgClass = 'bg-yellow-200';
                    statusTextClass = 'text-yellow-800';
                    break;
                case 'green-500':
                    cardBgClass = 'bg-green-100';
                    titleTextClass = 'text-green-900';
                    descriptionTextClass = 'text-green-800';
                    metaTextClass = 'text-green-700';
                    separatorClass = 'border-green-200';
                    statusBgClass = 'bg-green-200';
                    statusTextClass = 'text-green-800';
                    break;
                case 'slate-400':
                    cardBgClass = 'bg-slate-100';
                    titleTextClass = 'text-slate-900';
                    descriptionTextClass = 'text-slate-800';
                    metaTextClass = 'text-slate-700';
                    separatorClass = 'border-slate-200';
                    statusBgClass = 'bg-slate-200';
                    statusTextClass = 'text-slate-800';
                    break;
                default:
                    cardBgClass = 'bg-gray-100';
                    titleTextClass = 'text-gray-900';
                    descriptionTextClass = 'text-gray-700';
                    metaTextClass = 'text-gray-600';
                    separatorClass = 'border-gray-200';
                    statusBgClass = 'bg-gray-200';
                    statusTextClass = 'text-gray-700';
            }
        }
    }
    
    // 设置卡片样式，整体色系根据紧急程度显示
    card.className = `${cardBgClass} rounded-xl shadow-md overflow-hidden card-hover ${event.status === 'completed' ? 'opacity-70' : ''} transition-all duration-300`;
    
    // 对于过期事件，确保使用蓝灰色的紧急度颜色条
    const displayUrgencyClass = isOverdue ? 'slate-400' : urgencyClass;
    
    card.innerHTML = `
        <!-- 紧急度颜色条 -->
        <div class="h-2 bg-${displayUrgencyClass}"></div>
        <div class="p-5">
            <!-- 剩余时间 - 更加突出显示 (仅对非已完成事件显示) -->
            ${event.status !== 'completed' ? `<span class="inline-block px-3 py-1.5 text-sm font-medium rounded-full mb-2 ${getUrgencyColorClass(displayUrgencyClass)}">${timeLeft}</span>` : ''}
            
            <!-- 标题 - 作为主要内容 -->
            <h3 class="font-bold text-lg mb-2 ${event.status === 'completed' ? 'line-through' : ''} ${titleTextClass}">${event.title}</h3>
            
            <!-- 描述内容 - 次要信息 -->
            ${event.description ? `<p class="${descriptionTextClass} text-sm mb-4">${event.description}</p>` : ''}
            
            <!-- 元数据信息 -->
            <div class="flex justify-between items-center text-sm ${metaTextClass} mb-3">
                <span>
                    <i class="fa fa-calendar-o mr-1"></i>
                    ${formatDate(dueAt)}
                </span>
                <span class="flex items-center">
                    <i class="fa fa-flag-o mr-1"></i>
                    <span class="px-2 py-0.5 rounded-full ${priorityBgClass} ${priorityTextClass} text-xs">${priorityText}</span>
                </span>
            </div>
            
            <!-- 进度条 -->
            <div class="mt-3">
                <div class="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500 ease-out" 
                         style="width: ${progressPercentage}%; background-color: ${getStatusColor(statusBgClass)}"></div>
                </div>
                <div class="text-xs text-right mt-1 ${metaTextClass}">${Math.round(progressPercentage)}%</div>
            </div>
            
            <!-- 状态和操作按钮 -->
            <div class="flex justify-between items-center pt-3 border-t ${separatorClass}">
                <span class="text-xs px-2 py-1 rounded-full ${statusBgClass} ${statusTextClass}">${statusText}</span>
                
                <div class="flex gap-3">
                    ${event.status === 'active' && !isOverdue ? `
                        <button class="complete-btn ${titleTextClass} hover:opacity-80 focus:outline-none p-2 rounded-lg hover:bg-white/30"
                                data-id="${event.id}">
                            <i class="fa fa-check-circle text-xl"></i>
                        </button>
                    ` : ''}
                    ${event.status === 'active' && isOverdue ? `
                        <button class="makeup-complete-btn ${titleTextClass} hover:opacity-80 focus:outline-none p-2 rounded-lg hover:bg-white/30"
                                data-id="${event.id}">
                            <i class="fa fa-check-square-o text-xl"></i>
                        </button>
                    ` : ''}
                    ${event.status === 'completed' ? `` : `
                    <button class="edit-btn ${titleTextClass} hover:opacity-80 focus:outline-none p-2 rounded-lg hover:bg-white/30"
                            data-id="${event.id}">
                        <i class="fa fa-pencil text-xl"></i>
                    </button>`}
                    <button class="delete-btn ${titleTextClass} hover:opacity-80 focus:outline-none p-2 rounded-lg hover:bg-white/30"\n                            data-id="${event.id}">
                        <i class="fa fa-trash text-xl"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 绑定卡片点击事件 - 显示事件详情弹窗
    card.addEventListener('click', (e) => {
        // 阻止按钮点击触发卡片点击
        if (e.target.closest('button')) return;
        
        // 显示事件详情弹窗
        showEventDetail(event.id);
    });
    
    // 绑定按钮事件
    if (event.status === 'active' && !isOverdue) {
        const completeBtn = card.querySelector('.complete-btn');
        completeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            completeEvent(event.id);
        });
    } else if (event.status === 'active' && isOverdue) {
        const makeupCompleteBtn = card.querySelector('.makeup-complete-btn');
        makeupCompleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            completeEvent(event.id, true); // 传入true表示是补完成操作
        });
    }
    
    const editBtn = card.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(event.id);
        });
    }
    
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteEvent(event.id);
        });
    }
    
    return card;
}

// 从状态背景类中提取颜色值
function getStatusColor(bgClass) {
    // 根据背景类返回对应的颜色值
    if (bgClass.includes('red')) return '#f87171';
    if (bgClass.includes('green')) return '#34d399';
    if (bgClass.includes('yellow')) return '#facc15';
    if (bgClass.includes('orange')) return '#f97316';
    if (bgClass.includes('slate')) return '#94a3b8'; // 蓝灰色
    return '#94a3b8'; // 默认颜色
}
// 计算剩余时间
function calculateTimeLeft(dueAt, now) {
    const diffMs = dueAt - now;
    
    if (diffMs < 0) {
        // 已过期
        const hours = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `已过期 ${days} 天`;
        } else if (hours > 0) {
            return `已过期 ${hours} 小时`;
        } else {
            return '已过期';
        }
    }
    
    // 未过期
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 3) {
        return `还剩 ${days} 天`;
    } else if (days > 0) {
        return `还剩 ${days} 天`;
    } else if (hours > 0) {
        return `还剩 ${hours} 小时`;
    } else {
        return '即将到期';
    }
}

// 获取紧急程度样式类
function getUrgencyClass(dueAt, now, status) {
    if (status === 'completed') return 'gray-400';
    
    const diffMs = dueAt - now;
    const days = diffMs / (1000 * 60 * 60 * 24);
    
    if (days < 0) return 'slate-400'; // 已过期 - 蓝灰色
    if (days <= 2) return 'red-500'; // 2天内 - 红色
    if (days <= 5) return 'yellow-500'; // 2-5天 - 黄色
    return 'green-500'; // 5天以上 - 绿色
}

// 根据紧急度返回对应的颜色类
function getUrgencyColorClass(urgencyClass) {
    switch(urgencyClass) {
        case 'red-500':
            return 'bg-red-100 text-red-800';
        case 'yellow-500':
            return 'bg-yellow-100 text-yellow-800';
        case 'green-500':
            return 'bg-green-100 text-green-800';
        case 'slate-400':
            return 'bg-slate-100 text-slate-600';
        case 'gray-400':
        default:
            return 'bg-gray-100 text-gray-600';
    }
}

// 格式化日期
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 打开新增模态框
function openAddModal() {
    modalTitle.textContent = '新增事件';
    eventForm.reset();
    eventIdInput.value = '';
    
    // 设置默认日期时间
    const defaultDateTime = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
    eventDueAtInput.value = defaultDateTime;
    
    eventModal.classList.remove('hidden');
    eventTitleInput.focus();
    
    // 添加操作提示
    showActionToast('新增事件');
}

// 打开新增模态框（指定日期）
function openAddModalForDate(year, month, day) {
    modalTitle.textContent = '新增事件';
    eventForm.reset();
    eventIdInput.value = '';
    
    // 输出将要填充到弹窗的日期到控制台
    console.log('填充到弹窗的日期:', year, '年', month, '月', day, '日');
    
    // 设置为指定日期的当前时间，JavaScript的Date对象月份是从0开始计数的
    // 使用手动格式化避免时区偏移问题（不使用toISOString()）
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // 手动构建符合datetime-local格式的字符串：YYYY-MM-DDTHH:MM
    const targetDateTime = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hours}:${minutes}`;
    eventDueAtInput.value = targetDateTime;
    
    // 输出最终设置到输入框的值
    console.log('设置到输入框的值:', eventDueAtInput.value);
    
    eventModal.classList.remove('hidden');
    eventTitleInput.focus();
    
    // 添加操作提示
    showActionToast('指定日期新增事件');
}

// 打开编辑模态框
async function openEditModal(eventId) {
    try {
        const response = await fetch(`/api/v1/events/${eventId}`);
        if (!response.ok) throw new Error('Failed to fetch event');
        
        const event = await response.json();
        
        modalTitle.textContent = '编辑事件';
        eventIdInput.value = event.id;
        eventTitleInput.value = event.title;
        eventDescriptionInput.value = event.description || '';
        
        // 格式化日期时间为local datetime-local格式
        const dueAt = new Date(event.due_at);
        const formattedDueAt = dueAt.toISOString().slice(0, 16);
        eventDueAtInput.value = formattedDueAt;
        
        eventPriorityInput.value = event.priority;
        
        eventModal.classList.remove('hidden');
        eventTitleInput.focus();
        
        // 添加操作提示
        showActionToast('编辑事件');
    } catch (error) {
        showToast('加载事件详情失败', 'error');
        console.error('Error loading event:', error);
    }
}

// 关闭模态框
function closeModal() {
    eventModal.classList.add('hidden');
}

// 处理表单提交
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const eventId = eventIdInput.value;
    const isEdit = !!eventId;
    
    const eventData = {
        title: eventTitleInput.value,
        description: eventDescriptionInput.value,
        due_at: eventDueAtInput.value,
        priority: parseInt(eventPriorityInput.value)
    };
    
    try {
        let response;
        if (isEdit) {
            // 更新事件
            response = await fetch(`/api/v1/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
        } else {
            // 新增事件
            response = await fetch('/api/v1/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
        }
        
        if (!response.ok) throw new Error('Failed to save event');
        
        await response.json();
        closeModal();
        loadEvents();
        showToast(isEdit ? '事件更新成功' : '事件创建成功', 'success');
        
        // 添加操作提示
        showActionToast(isEdit ? '保存编辑' : '创建事件');
    } catch (error) {
        showToast(isEdit ? '事件更新失败' : '事件创建失败', 'error');
        console.error('Error saving event:', error);
    }
}

// 标记事件完成
function completeEvent(eventId, isMakeup = false) {
    // 从currentEvents中查找事件标题
    const event = currentEvents.find(e => e.id === eventId);
    const eventTitle = event ? event.title : '事件';
    
    // 根据是否是补完成操作显示不同的确认提示语
    const modalTitle = isMakeup ? '确认补完成' : '确认标记完成';
    const modalMessage = isMakeup ? 
        `确定要将已过期事件 "${eventTitle}" 标记为补完成吗？` : 
        `确定要将事件 "${eventTitle}" 标记为完成吗？`;
    
    // 添加操作提示
    showActionToast(isMakeup ? '补完成事件' : '完成事件');
    
    showConfirmModal(modalTitle, modalMessage, async (confirmed) => {
        if (confirmed) {
            try {
                // 使用新的complete端点，自动记录完成时间到event_actions表
                const response = await fetch(`/api/v1/events/${eventId}/complete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ comment: isMakeup ? '补完成' : '' })
                });
                
                if (!response.ok) throw new Error('Failed to complete event');
                
                await response.json();
                loadEvents();
                showToast(isMakeup ? '事件已补完成' : '事件已标记完成', 'success');
            } catch (error) {
                showToast(isMakeup ? '补完成失败' : '标记完成失败', 'error');
                console.error('Error completing event:', error);
            }
        }
    });
}

// 重新打开已完成的事件
function reopenEvent(eventId) {
    // 从currentEvents中查找事件标题
    const event = currentEvents.find(e => e.id === eventId);
    const eventTitle = event ? event.title : '事件';
    
    // 添加操作提示
    showActionToast('重新打开事件');
    
    showConfirmModal('确认重新打开', `确定要将已完成事件 "${eventTitle}" 重新打开吗？`, async (confirmed) => {
        if (confirmed) {
            try {
                // 使用新的reopen端点，自动记录重新打开操作到event_actions表
                const response = await fetch(`/api/v1/events/${eventId}/reopen`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });
                
                if (!response.ok) throw new Error('Failed to reopen event');
                
                await response.json();
                loadEvents();
                showToast('事件已重新打开', 'success');
            } catch (error) {
                showToast('重新打开失败', 'error');
                console.error('Error reopening event:', error);
            }
        }
    });
}

// 删除事件
function deleteEvent(eventId) {
    // 从currentEvents中查找事件标题
    const event = currentEvents.find(e => e.id === eventId);
    const eventTitle = event ? event.title : '事件';
    
    // 添加操作提示
    showActionToast('删除事件');
    
    showConfirmModal('确认删除', `确定要删除事件 "${eventTitle}" 吗？`, async (confirmed) => {
        if (confirmed) {
            try {
                const response = await fetch(`/api/v1/events/${eventId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) throw new Error('Failed to delete event');
                
                await response.json();
                loadEvents();
                showToast('事件删除成功', 'success');
            } catch (error) {
                showToast('事件删除失败', 'error');
                console.error('Error deleting event:', error);
            }
        }
    });
}

// 更新过滤器按钮状态
function updateFilterButtons() {
    statusFilterBtns.forEach(btn => {
        const status = btn.getAttribute('data-status');
        if (status === currentStatus) {
            btn.classList.add('bg-primary/10', 'text-primary', 'border-primary');
            btn.classList.remove('bg-white', 'text-gray-700', 'border-gray-300');
        } else {
            btn.classList.remove('bg-primary/10', 'text-primary', 'border-primary');
            btn.classList.add('bg-white', 'text-gray-700', 'border-gray-300');
        }
    });
}

// 处理搜索
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (currentView === 'list') {
        if (!searchTerm) {
            renderEvents();
            // 添加操作提示
            showActionToast('清除搜索筛选');
            return;
        }
        
        const filteredEvents = currentEvents.filter(event => 
            event.title.toLowerCase().includes(searchTerm) ||
            (event.description && event.description.toLowerCase().includes(searchTerm))
        );
        
        renderEvents(filteredEvents);
        // 添加操作提示
        showActionToast(`搜索: ${searchTerm}`);
    } else if (currentView === 'calendar') {
        // 日历视图下的搜索处理：过滤事件后重新渲染日历
        let filteredEvents = currentEvents;
        if (searchTerm) {
            filteredEvents = currentEvents.filter(event => 
                event.title.toLowerCase().includes(searchTerm) ||
                (event.description && event.description.toLowerCase().includes(searchTerm))
            );
            // 添加操作提示
            showActionToast(`搜索: ${searchTerm}`);
        } else {
            // 添加操作提示
            showActionToast('清除搜索筛选');
        }
        
        // 在日历中临时使用过滤后的事件重新渲染
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const monthlyEvents = groupEventsByDate(filteredEvents, year, month);
        
        // 清空日历格子并重新渲染
        const days = calendarGrid.querySelectorAll('.min-h-\[100px\]');
        let dayIndex = 0;
        
        // 添加上个月的日期（跳过）
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        dayIndex = firstDayOfWeek;
        
        // 重新渲染当月的日期
        const lastDay = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        
        for (let day = 1; day <= lastDay; day++) {
            if (dayIndex < days.length) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = monthlyEvents[dateStr] || [];
                const isToday = isCurrentMonth && today.getDate() === day;
                
                // 清空并重新填充事件
                const dayCell = days[dayIndex];
                const eventsListContainer = dayCell.querySelector('.text-xs.overflow-hidden');
                
                if (eventsListContainer) {
                    eventsListContainer.innerHTML = '';
                    
                    // 最多显示3个事件标题
                    const displayEvents = dayEvents.slice(0, 3);
                    displayEvents.forEach(event => {
                        const eventItem = document.createElement('div');
                        eventItem.className = 'mb-1 line-clamp-1 px-1 rounded';
                        
                        // 根据事件状态设置不同颜色
                        if (event.status === 'completed') {
                            eventItem.className += ' text-gray-500 line-through';
                        } else if (new Date(event.due_at) < new Date()) {
                            eventItem.className += ' text-red-600 font-medium';
                        } else {
                            eventItem.className += ' text-gray-800';
                        }
                        
                        eventItem.textContent = event.title;
                        eventItem.addEventListener('click', () => showEventDetail(event.id));
                        eventsListContainer.appendChild(eventItem);
                    });
                    
                    // 如果事件超过3个，显示省略号
                    if (dayEvents.length > 3) {
                        const moreEl = document.createElement('div');
                        moreEl.className = 'text-gray-500 text-xs italic';
                        moreEl.textContent = `还有 ${dayEvents.length - 3} 个事件...`;
                        eventsListContainer.appendChild(moreEl);
                    }
                }
                
                // 根据事件数量设置背景色
                dayCell.className = dayCell.className.replace(/bg-blue-\d+/g, '');
                if (dayEvents.length > 0) {
                    if (dayEvents.length === 1) {
                        dayCell.classList.add('bg-blue-50');
                    } else if (dayEvents.length === 2) {
                        dayCell.classList.add('bg-blue-100');
                    } else if (dayEvents.length >= 3) {
                        dayCell.classList.add('bg-blue-200');
                    }
                }
            }
            dayIndex++;
        }
    }
}

// 显示操作提示Toast
function showActionToast(actionName) {
    // 检查全局开关和操作提示类别开关
    if (!notificationSettings.enabled || !notificationSettings.categories.action) return;
    
    toastMessage.textContent = `执行了${actionName}操作`;
    
    // 设置图标和样式 - 使用信息类型的样式
    toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 z-50 flex items-center bg-primary/90 text-white backdrop-blur-sm';
    toastIcon.className = 'fa fa-cog mr-2';
    
    // 显示Toast
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// 切换通知全局开关
function toggleNotifications(enabled) {
    if (enabled !== undefined) {
        notificationSettings.enabled = enabled;
    } else {
        notificationSettings.enabled = !notificationSettings.enabled;
    }
    
    // 更新所有类别开关状态（可选：当全局关闭时，可以同步关闭所有类别）
    if (!notificationSettings.enabled) {
        Object.keys(notificationSettings.categories).forEach(category => {
            notificationSettings.categories[category] = false;
        });
    }
    
    showToast(notificationSettings.enabled ? '已开启所有通知' : '已关闭所有通知', 'info');
    
    // 更新开关UI状态
    const notificationToggle = document.getElementById('notification-toggle');
    if (notificationToggle) {
        notificationToggle.checked = notificationSettings.enabled;
    }
}

// 显示Toast消息
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    
    // 设置图标和样式
    toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 z-50 flex items-center';
    
    if (type === 'success') {
        toast.classList.add('bg-success', 'text-white');
        toastIcon.className = 'fa fa-check-circle mr-2';
    } else if (type === 'error') {
        toast.classList.add('bg-danger', 'text-white');
        toastIcon.className = 'fa fa-exclamation-circle mr-2';
    } else {
        toast.classList.add('bg-primary', 'text-white');
        toastIcon.className = 'fa fa-info-circle mr-2';
    }
    
    // 显示Toast
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// 启动应用
window.addEventListener('DOMContentLoaded', init);

// 定期刷新事件（每分钟）
setInterval(() => {
    loadEvents();
}, 60000);