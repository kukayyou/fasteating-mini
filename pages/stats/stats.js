const app = getApp();

Page({
  data: {
    activeTab: 'day', // 当前激活的标签页
    selectedDate: '', // 日统计选中的日期
    today: '', // 今天的日期
    dayStats: {
      completed: false,
      mealCount: 0,
      duration: 0,
      meals: []
    },
    weekStart: '', // 周统计开始日期
    weekEnd: '', // 周统计结束日期
    weekDays: [], // 周统计日期数据
    weekStats: {
      completedDays: 0,
      totalDays: 0,
      completionRate: 0
    },
    currentMonth: '', // 月统计当前月份
    monthDays: [], // 月统计日期数据
    monthStats: {
      completedDays: 0,
      totalDays: 0,
      completionRate: 0
    },
    showWeekDetails: false, // 控制周详情是否展示
    weekDetailedData: [], // 存储周详细数据
    showMonthDetails: false, // 控制月详情是否展示
    monthDetailedData: [] // 存储月详细数据
  },
  // 切换周详情展示状态
  toggleWeekDetails() {
    this.setData({
      showWeekDetails: !this.data.showWeekDetails
    });
  },

  // 添加切换月详情展示状态的方法
  toggleMonthDetails() {
    this.setData({
      showMonthDetails: !this.data.showMonthDetails
    });
  },

  onLoad() {
    const today = new Date();
    const todayStr = this.formatDate(today);

    this.setData({
      selectedDate: todayStr,
      today: todayStr
    });

    this.loadDayStats(todayStr);
    this.initWeekStats();
    this.initMonthStats();
  },

  onShow() {
    // 每次页面显示时，强制切换到今日记录标签
    const todayStr = this.data.today;
    this.setData({
      activeTab: 'day', // 默认显示今日记录标签
      selectedDate: todayStr // 选中日期设为今天
    });
    // 页面显示时刷新所有数据
    this.loadDayStats(this.data.selectedDate);
    this.loadWeekStats(new Date(this.data.weekStart), new Date(this.data.weekEnd));
    this.loadMonthStats(new Date(this.data.monthStart), new Date(this.data.monthEnd));
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    // 每次切换标签页都回到当前日志
    const todayStr = this.data.today;
    switch (tab) {
      case 'day':
        this.setData({
          selectedDate: todayStr
        });
        this.loadDayStats(todayStr);
        break;

      case 'week':
        this.initWeekStats(); // 重新初始化周统计
        break;

      case 'month':
        this.initMonthStats(); // 重新初始化月统计
        break;
    }
  },

  // 日统计 - 选择日期
  changeDate(e) {
    const date = e.detail.value;
    this.setData({
      selectedDate: date
    });
    this.loadDayStats(date);
  },

  // 加载日统计数据
  loadDayStats(date) {
    const records = app.globalData.mealRecords;
    const meals = records[date] || [];
    const fastingMode = app.globalData.fastingMode;

    // 计算进食窗口时长
    let duration = 0;
    if (meals.length >= 2) {
      const firstMeal = meals[0];
      const lastMeal = meals[meals.length - 1];

      const [firstHour, firstMinute] = firstMeal.split(':').map(Number);
      const [lastHour, lastMinute] = lastMeal.split(':').map(Number);

      const startMinutes = firstHour * 60 + firstMinute;
      let endMinutes = lastHour * 60 + lastMinute;

      // 处理跨天情况：如果结束时间早于开始时间，加24小时
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // 24小时的分钟数
      }

      duration = ((endMinutes - startMinutes) / 60).toFixed(1);
    }

    // 判断是否完成
    const expectedMeals = fastingMode === '168' ? 3 : 2;
    const durationMeals = fastingMode === '168' ? 8 : 4;
    const completed = meals.length > 0 && duration <= durationMeals;

    // 格式化进餐数据
    const formattedMeals = meals.map((time, index) => {
      let type = '';
      if (fastingMode === '168') {
        const types = ['第一餐', '第二餐', '第三餐'];
        type = types[index] || '加餐';
      } else {
        const types = ['第一餐', '第二餐'];
        type = types[index] || '加餐';
      }
      return {
        time,
        type
      };
    });

    this.setData({
      dayStats: {
        completed,
        mealCount: meals.length,
        duration,
        meals: formattedMeals
      }
    });
  },

  // 初始化周统计数据
  initWeekStats() {
    const today = new Date();
    const day = today.getDay(); // 0-6，0是周日
    let monday;

    if (day === 0) {
      // 今天是周日，周一为今天往前推6天
      monday = new Date(today);
      monday.setDate(today.getDate() - 6);
    } else {
      // 今天是周一到周六，周一为今天往前推 (day-1) 天
      monday = new Date(today);
      monday.setDate(today.getDate() - (day - 1));
    }

    // 基于周一计算周日（加6天），独立对象避免影响
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const weekStart = this.formatDate(monday);
    const weekEnd = this.formatDate(sunday);
    console.log("weekStart,weekEnd:", weekStart, weekEnd)
    this.setData({
      weekStart,
      weekEnd,
    });

    this.loadWeekStats(monday, sunday);
  },

  // 加载周统计数据
  loadWeekStats(startDate, endDate) {
    const records = app.globalData.mealRecords;
    const fastingMode = app.globalData.fastingMode;
    const expectedMeals = fastingMode === '168' ? 3 : 2;
    const durationMeals = fastingMode === '168' ? 8 : 4;

    let completedDays = 0;
    let totalDays = 0;
    const weekDays = [];
    const weekDetailedData = []; // 存储详细数据

    // 生成一周的日期
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = this.formatDate(currentDate);
      // 添加以下代码
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      const weekDayName = `周${weekdays[currentDate.getDay()]}`;
      const meals = records[dateStr] || [];
      // 计算进食窗口时长（修复跨天问题）
      let duration = 0;
      if (meals.length >= 2) {
        const firstMeal = meals[0];
        const lastMeal = meals[meals.length - 1];

        const [firstHour, firstMinute] = firstMeal.split(':').map(Number);
        const [lastHour, lastMinute] = lastMeal.split(':').map(Number);

        const startMinutes = firstHour * 60 + firstMinute;
        let endMinutes = lastHour * 60 + lastMinute;

        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        duration = ((endMinutes - startMinutes) / 60).toFixed(1);
      }
      const completed = meals.length > 0 && duration <= durationMeals;
      // 格式化进餐数据用于详情展示
      const formattedMeals = meals.map((time, index) => {
        let type = '';
        if (fastingMode === '168') {
          const types = ['第一餐', '第二餐', '第三餐'];
          type = types[index] || '加餐';
        } else {
          const types = ['第一餐', '第二餐'];
          type = types[index] || '加餐';
        }
        return {
          time,
          type
        };
      });
      // 保存详细数据
      weekDetailedData.push({
        date: dateStr,
        day: currentDate.getDate(),
        completed,
        weekDay: weekDayName, // 新增星期几信息
        meals: formattedMeals,
        duration
      });

      if (completed) completedDays++;
      totalDays++;

      weekDays.push({
        date: dateStr,
        day: currentDate.getDate(),
        completed
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    this.setData({
      weekDays,
      weekDetailedData, // 保存详细数据
      weekStats: {
        completedDays,
        totalDays,
        completionRate
      }
    });
  },

  // 上一周
  prevWeek() {
    const startDate = new Date(this.data.weekStart);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    this.setData({
      weekStart: this.formatDate(startDate),
      weekEnd: this.formatDate(endDate),
      // 临时隐藏详情，触发重新渲染
      showWeekDetails: false
    }, () => {
      // 确保日期更新后再加载数据
      this.loadWeekStats(startDate, endDate);
      // 恢复详情展开状态（如果之前是展开的）
      this.setData({
        showWeekDetails: this.data.showWeekDetails // 保持原有状态
      });
    });
  },

  // 下一周
  nextWeek() {
    const startDate = new Date(this.data.weekStart);
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // 先更新起止日期，再重新加载数据，最后保持详情展开状态
    this.setData({
      weekStart: this.formatDate(startDate),
      weekEnd: this.formatDate(endDate),
      // 临时隐藏详情，触发重新渲染
      showWeekDetails: false
    }, () => {
      // 确保日期更新后再加载数据
      this.loadWeekStats(startDate, endDate);
      // 恢复详情展开状态（如果之前是展开的）
      this.setData({
        showWeekDetails: this.data.showWeekDetails // 保持原有状态
      });
    });
  },

  // 初始化月统计数据
  initMonthStats() {
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();

    this.setData({
      currentMonth: `${year}年${month + 1}月`,
      loadingMonth: true
    });

    this.loadMonthStats(year, month);
  },
  // 加载月统计数据
  loadMonthStats(year, month) {
    // 获取当前月份第一天和最后一天
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // 获取当前月第一天是星期几（0-6，0代表周日）
    const firstDayOfWeek = monthStart.getDay();

    const records = app.globalData.mealRecords;
    console.log("records:", records)
    const fastingMode = app.globalData.fastingMode;
    const expectedMeals = fastingMode === '168' ? 3 : 2;
    const durationMeals = fastingMode === '168' ? 8 : 4;

    let completedDays = 0;
    let totalDays = 0;
    const monthDays = [];
    const monthDetailedData = []; // 存储月详细数据

    // 关键修改：补充上个月的末尾日期（而非空白单元格）
    if (firstDayOfWeek > 0) {
      // 计算需要补充的上个月天数（例如：10月1日是周一，需要补1天（周日））
      const prevMonth = month - 1;
      const prevYear = prevMonth < 0 ? year - 1 : year;
      // 上个月最后一天
      const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

      // 从上个月的最后一天往前推，补充足够的天数
      for (let i = 0; i < firstDayOfWeek; i++) {
        const day = lastDayOfPrevMonth - firstDayOfWeek + i + 1;
        const date = new Date(prevYear, prevMonth, day);
        const dateStr = this.formatDate(date);
        const meals = records[dateStr] || [];

        // 计算该日期的完成状态（仅展示用，不纳入当前月统计）
        let duration = 0;
        if (meals.length >= 2) {
          const firstMeal = meals[0];
          const lastMeal = meals[meals.length - 1];
          const [firstHour, firstMinute] = firstMeal.split(':').map(Number);
          const [lastHour, lastMinute] = lastMeal.split(':').map(Number);
          const startMinutes = firstHour * 60 + firstMinute;
          let endMinutes = lastHour * 60 + lastMinute;
          if (endMinutes < startMinutes) endMinutes += 24 * 60;
          duration = ((endMinutes - startMinutes) / 60).toFixed(1);
        }
        const completed = meals.length > 0 && duration <= durationMeals;

        monthDays.push({
          date: dateStr,
          day,
          completed,
          isPrevMonth: true // 标记为上个月日期
        });
      }
    }

    // 生成当前月份的所有日期
    const currentDate = new Date(monthStart);
    while (currentDate <= monthEnd) {
      const dateStr = this.formatDate(currentDate);
      // 获取年份、月份（注意月份从0开始，需+1）、日期
      const year = currentDate.getFullYear();
      let month = currentDate.getMonth() + 1; // 月份范围0-11，+1后为1-12
      let day = currentDate.getDate(); // 日期范围1-31

      // 补零处理：确保月份和日期为两位数（如1月→01月，5日→05日）
      month = month < 10 ? '0' + month : month;
      day = day < 10 ? '0' + day : day;
      // 拼接为目标格式
      const weekDayName = `${year}年${month}月${day}日`;
      const meals = records[dateStr] || [];
      let duration = 0;
      if (meals.length >= 2) {
        const firstMeal = meals[0];
        const lastMeal = meals[meals.length - 1];
        const [firstHour, firstMinute] = firstMeal.split(':').map(Number);
        const [lastHour, lastMinute] = lastMeal.split(':').map(Number);
        const startMinutes = firstHour * 60 + firstMinute;
        let endMinutes = lastHour * 60 + lastMinute;
        if (endMinutes < startMinutes) endMinutes += 24 * 60;
        duration = ((endMinutes - startMinutes) / 60).toFixed(1);
      }
      const completed = meals.length > 0 && duration <= durationMeals;

      // 格式化进餐数据用于详情展示
      const formattedMeals = meals.map((time, index) => {
        let type = '';
        if (fastingMode === '168') {
          const types = ['第一餐', '第二餐', '第三餐'];
          type = types[index] || '加餐';
        } else {
          const types = ['第一餐', '第二餐'];
          type = types[index] || '加餐';
        }
        return {
          time,
          type
        };
      });

      // 保存详细数据
      monthDetailedData.push({
        date: dateStr,
        day: currentDate.getDate(),
        completed,
        weekDay: weekDayName,
        meals: formattedMeals,
        duration
      });

      if (completed) completedDays++;
      totalDays++; // 仅统计当前月天数

      monthDays.push({
        date: dateStr,
        day: currentDate.getDate(),
        completed,
        isPrevMonth: false // 标记为当前月日期
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 计算当前月完成率（仅包含当前月日期）
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    this.setData({
      monthDays,
      monthDetailedData, // 保存详细数据
      monthStats: {
        completedDays,
        totalDays,
        completionRate
      }
    });
  },

  // 上个月
  prevMonth() {
    const [yearStr, monthStr] = this.data.currentMonth.split('年');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr.replace('月', '')) - 1;

    // 计算上个月的年月
    let prevYear = year;
    let prevMonth = month - 1;

    if (prevMonth < 0) {
      prevYear--;
      prevMonth = 11; // 12月
    }

    this.setData({
      currentMonth: `${prevYear}年${prevMonth + 1}月`,
      // 临时隐藏详情，触发重新渲染
      showMonthDetails: false
    }, () => {
      // 确保日期更新后再加载数据
      this.loadMonthStats(prevYear, prevMonth);
      // 恢复详情展开状态（如果之前是展开的）
      this.setData({
        showMonthDetails: this.data.showMonthDetails
      });
    });
  },

  // 下个月
  nextMonth() {
    const [yearStr, monthStr] = this.data.currentMonth.split('年');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr.replace('月', '')) - 1;

    // 计算下个月的年月
    let nextYear = year;
    let nextMonth = month + 1;

    if (nextMonth > 11) {
      nextYear++;
      nextMonth = 0; // 1月
    }

    this.setData({
      currentMonth: `${nextYear}年${nextMonth + 1}月`,
      // 临时隐藏详情，触发重新渲染
      showMonthDetails: false
    }, () => {
      // 确保日期更新后再加载数据
      this.loadMonthStats(nextYear, nextMonth);
      // 恢复详情展开状态（如果之前是展开的）
      this.setData({
        showMonthDetails: this.data.showMonthDetails
      });
    });
  },

  // 选择日期
  selectDay(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;

    this.setData({
      activeTab: 'day',
      selectedDate: date
    });

    this.loadDayStats(date);
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  onShareAppMessage() {
    return {
      title: '我的断食统计数据，一起来坚持健康计划！',
      path: '/pages/stats/stats',
      imageUrl: '/images/share-friend.png'
    }
  },

  onShareTimeline() {
    return {
      title: '看看我的断食成果，加入健康生活方式！',
      query: 'from=timeline',
      imageUrl: '/images/share-friend.png'
    }
  }
});