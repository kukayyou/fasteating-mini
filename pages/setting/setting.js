const app = getApp();

Page({
  data: {
    fastingMode: '168',
    eatingStart: '09:00',
    eatingEnd: '17:00',
    reminderTimes: [],
    showSuccessToast: false
  },
  
  onLoad() {
    const { fastingMode, eatingStart, eatingEnd, reminderTimes } = app.globalData;
    this.setData({
      fastingMode,
      eatingStart,
      eatingEnd,
      reminderTimes
    });
  },
  
  // 选择模式
  selectMode(e) {
    const newMode = e.currentTarget.dataset.mode;
    
    // 根据模式设置不同的默认时间
    let newStart = this.data.eatingStart || '09:00';
    let newEnd = this.calculateEndTime(newStart, newMode);
    
    this.setData({
      fastingMode: newMode,
      eatingEnd: newEnd
    });
    
    // 计算提醒时间
    this.calculateReminderTimes();
    
    // 保存设置
    this.saveSettings();
  },
  
  // 更改开始时间
  changeStartTime(e) {
    const newStart = e.detail.value;
    const newEnd = this.calculateEndTime(newStart, this.data.fastingMode);
    
    this.setData({
      eatingStart: newStart,
      eatingEnd: newEnd
    });
    
    // 计算提醒时间
    this.calculateReminderTimes();
    
    // 保存设置
    this.saveSettings();
  },
  
  // 计算结束时间
  calculateEndTime(startTime, mode) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const addHours = mode === '168' ? 8 : 4;
    
    // 计算结束时间
    let endHours = hours + addHours;
    if (endHours >= 24) {
      endHours -= 24;
    }
    
    // 格式化为两位数
    const formattedHours = endHours.toString().padStart(2, '0');
    return `${formattedHours}:${minutes.toString().padStart(2, '0')}`;
  },
  
  // 计算提醒时间
  calculateReminderTimes() {
    const { fastingMode, eatingStart, eatingEnd } = this.data;
    const times = [];
    
    if (fastingMode === '168') {
      // 168模式：三餐提醒
      const startHour = parseInt(eatingStart.split(':')[0]);
      const endHour = parseInt(eatingEnd.split(':')[0]);
      const interval = Math.floor((endHour - startHour) / 2);
      
      times.push(eatingStart);
      times.push(`${startHour + interval}:00`);
      times.push(eatingEnd);
    } else {
      // 204模式：两餐提醒
      times.push(eatingStart);
      times.push(eatingEnd);
    }
    
    this.setData({ reminderTimes: times });
  },
  
  // 保存设置
  saveSettings() {
    app.globalData.fastingMode = this.data.fastingMode;
    app.globalData.eatingStart = this.data.eatingStart;
    app.globalData.eatingEnd = this.data.eatingEnd;
    app.saveSetting();
    
    // 显示成功提示
    this.showSuccessToast();
    
    // 通知今日页面更新
    this.notifyIndexPage();
  },
  
  // 显示成功提示
  showSuccessToast() {
    this.setData({
      showSuccessToast: true
    });
    
    // 3秒后自动隐藏
    setTimeout(() => {
      this.setData({
        showSuccessToast: false
      });
    }, 800);
  },
  
  // 通知今日页面更新
  notifyIndexPage() {
    const pages = getCurrentPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page.route === 'pages/index/index') {
        page.onShow && page.onShow();
      }
    }
  }
});