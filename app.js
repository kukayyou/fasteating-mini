App({
    globalData: {
      fastingMode: '168', // 默认168断食法
      eatingStart: '9:00', // 默认开始时间
      eatingEnd: '17:00', // 默认结束时间
      mealRecords: {}, // 进餐记录
      reminderTimes: [], // 提醒时间点
      lastMealTime: null // 最后一次进餐时间
    },
    // 事件监听器
  eventListeners: {},
  
  // 添加事件监听
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  },
  
  // 触发事件
  emit(event, data) {
    const listeners = this.eventListeners[event];
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  },
  
  // 移除事件监听
  off(event, callback) {
    const listeners = this.eventListeners[event];
    if (listeners) {
      this.eventListeners[event] = listeners.filter(cb => cb !== callback);
    }
  },
    onLaunch() {
      // 从本地存储加载数据
      this.loadData();
      // 设置提醒
      this.setupReminders();
    },
    
    loadData() {
      const setting = wx.getStorageSync('fastingSetting');
      if (setting) {
        this.globalData.fastingMode = setting.mode || '168';
        this.globalData.eatingStart = setting.start || '9:00';
        this.globalData.eatingEnd = setting.end || '17:00';
      }
      
      const records = wx.getStorageSync('mealRecords');
      if (records) {
        this.globalData.mealRecords = records;
      }
    },
    
    saveSetting() {
      wx.setStorageSync('fastingSetting', {
        mode: this.globalData.fastingMode,
        start: this.globalData.eatingStart,
        end: this.globalData.eatingEnd
      });
      this.calculateReminderTimes();
      this.setupReminders();
    },
    
    calculateReminderTimes() {
      const { fastingMode, eatingStart, eatingEnd } = this.globalData;
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
      
      this.globalData.reminderTimes = times;
    },
    
    setupReminders() {
      this.calculateReminderTimes();
      // 实际应用中这里会设置定时提醒
      console.log('设置提醒时间:', this.globalData.reminderTimes);
    },
    
    recordMeal(time) {
      const today = new Date().toISOString().split('T')[0];
      if (!this.globalData.mealRecords[today]) {
        this.globalData.mealRecords[today] = [];
      }
      
      const mealTime = new Date();
      const formattedTime = `${mealTime.getHours().toString().padStart(2, '0')}:${mealTime.getMinutes().toString().padStart(2, '0')}`;
      
      this.globalData.mealRecords[today].push(formattedTime);
      this.globalData.lastMealTime = formattedTime;
      
      wx.setStorageSync('mealRecords', this.globalData.mealRecords);
    },
    
    showReminder() {
      // 在实际应用中会显示提醒弹窗
      console.log('显示进餐提醒');
    }
  });