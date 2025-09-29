const app = getApp();

Page({
  data: {
    fastingMode: '168',
    eatingStart: '09:00',
    eatingEnd: '17:00',
    progress: 50,
    todayMeals: [],
    isFasting: false,
    remainingTime: '4.5',
    showPicker: false, // 控制时间选择器显示
    selectedTime: '12:00', // 默认选择的时间
    editingIndex: -1 // 当前编辑的记录索引
  },
  
  onLoad() {
    this.updateCurrentTime();
    setInterval(this.updateCurrentTime, 60000);
    
    // 监听设置变更事件
    app.on('settingsChanged', this.handleSettingsChange);
  },
  
  onUnload() {
    // 移除事件监听
    app.off('settingsChanged', this.handleSettingsChange);
  },
  
  onShow() {
    this.updatePageData();
  },
  
  // 处理设置变更
  handleSettingsChange(settings) {
    this.setData({
      fastingMode: settings.mode,
      eatingStart: settings.start,
      eatingEnd: settings.end
    });
    
    // 重新计算状态
    this.setData({
      isFasting: this.checkFastingStatus()
    });
    this.calculateProgress();
    
    // 更新进餐记录显示
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = app.globalData.mealRecords[today] || [];
    this.setData({ todayMeals });
  },
  
  // 更新页面数据
  updatePageData() {
    const { fastingMode, eatingStart, eatingEnd, mealRecords } = app.globalData;
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = mealRecords[today] || [];
    
    this.setData({
      fastingMode,
      eatingStart,
      eatingEnd,
      todayMeals,
      isFasting: this.checkFastingStatus()
    });
    
    this.calculateProgress();
  },
  
  updateCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.setData({
      currentTime: `${hours}:${minutes}`
    });
    this.calculateProgress();
    this.setData({
      isFasting: this.checkFastingStatus()
    });
  },
  
  checkFastingStatus() {
    const { eatingStart, eatingEnd } = this.data;
    const [startHour, startMinute] = eatingStart.split(':').map(Number);
    const [endHour, endMinute] = eatingEnd.split(':').map(Number);
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // 创建开始和结束时间对象
    const startTime = new Date();
    startTime.setHours(startHour, startMinute, 0);
    
    const endTime = new Date();
    endTime.setHours(endHour, endMinute, 0);
    
    // 处理跨天情况（结束时间在第二天）
    if (endHour < startHour) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    return now < startTime || now > endTime;
  },
  
  calculateProgress() {
    const { eatingStart, eatingEnd } = this.data;
    const [startHour, startMinute] = eatingStart.split(':').map(Number);
    const [endHour, endMinute] = eatingEnd.split(':').map(Number);
    
    // 创建时间对象
    const startTime = new Date();
    startTime.setHours(startHour, startMinute, 0);
    
    const endTime = new Date();
    endTime.setHours(endHour, endMinute, 0);
    
    // 处理跨天情况
    if (endHour < startHour) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    const now = new Date();
    
    if (now < startTime) {
      this.setData({ 
        progress: 0,
        remainingTime: ((endTime - startTime) / (1000 * 60 * 60)).toFixed(1)
      });
    } else if (now > endTime) {
      this.setData({ 
        progress: 100,
        remainingTime: '0.0'
      });
    } else {
      const totalTime = endTime - startTime;
      const elapsedTime = now - startTime;
      const progress = (elapsedTime / totalTime) * 100;
      const remainingHours = ((endTime - now) / (1000 * 60 * 60)).toFixed(1);
      
      this.setData({ 
        progress: Math.min(100, Math.max(0, Math.round(progress))),
        remainingTime: remainingHours
      });
    }
  },
  
  getMealType(index) {
    const { fastingMode } = this.data;
    if (fastingMode === '168') {
      const types = ['第一餐', '第二餐', '第三餐'];
      return types[index] || '加餐';
    } else {
      return index === 0 ? '第一餐' : '第二餐';
    }
  },
  
  recordMealNow() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const mealTime = `${hours}:${minutes}`;
    
    // 记录进餐并更新全局数据
    app.recordMeal(mealTime);
    
    // 更新页面数据
    this.updatePageData();
    
    wx.showToast({
      title: '进餐已记录',
      icon: 'success'
    });
    
    // 通知统计页面刷新数据
    this.notifyStatsPage();
  },
  
  // 显示时间选择器
  showTimePicker(e) {
    const index = e.currentTarget.dataset.index;
    const mealTime = this.data.todayMeals[index];
    
    this.setData({
      showPicker: true,
      editingIndex: index,
      selectedTime: mealTime
    });
  },
  
  // 隐藏时间选择器
  hidePicker() {
    this.setData({
      showPicker: false
    });
  },
  
  // 时间选择变化
  timeChange(e) {
    this.setData({
      selectedTime: e.detail.value
    });
  },
  
  // 更新进餐时间
  updateMealTime() {
    const { editingIndex, selectedTime } = this.data;
    if (editingIndex === -1) return;
    
    const today = new Date().toISOString().split('T')[0];
    const meals = [...app.globalData.mealRecords[today]];
    
    if (editingIndex >= 0 && editingIndex < meals.length) {
      meals[editingIndex] = selectedTime;
      app.globalData.mealRecords[today] = meals;
      wx.setStorageSync('mealRecords', app.globalData.mealRecords);
      
      this.setData({
        todayMeals: meals,
        showPicker: false
      });
      
      wx.showToast({
        title: '时间已更新',
        icon: 'success'
      });
    }
  },
  
  // 删除进餐记录
  deleteMeal(e) {
    const index = e.currentTarget.dataset.index;
    
    wx.showModal({
      title: '确认删除',
      content: '要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.removeMeal(index);
        }
      }
    });
  },
  
  // 删除进餐记录
  removeMeal(index) {
    const today = new Date().toISOString().split('T')[0];
    const meals = [...app.globalData.mealRecords[today]];
    
    if (index >= 0 && index < meals.length) {
      meals.splice(index, 1);
      app.globalData.mealRecords[today] = meals;
      wx.setStorageSync('mealRecords', app.globalData.mealRecords);
      
      this.setData({
        todayMeals: meals
      });
      
      wx.showToast({
        title: '已删除',
        icon: 'success'
      });
    }
  },
  
  // 通知统计页面刷新数据
  notifyStatsPage() {
    const pages = getCurrentPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page.route === 'pages/stats/stats') {
        page.onShow && page.onShow();
      }
    }
  }
});