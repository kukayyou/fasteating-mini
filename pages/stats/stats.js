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
        }
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
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 获取本周一的日期

        const monday = new Date(today.setDate(diff));
        const sunday = new Date(today.setDate(diff + 6));

        const weekStart = this.formatDate(monday);
        const weekEnd = this.formatDate(sunday);

        this.setData({
            weekStart,
            weekEnd
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

        // 生成一周的日期
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = this.formatDate(currentDate);
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
            weekEnd: this.formatDate(endDate)
        });

        this.loadWeekStats(startDate, endDate);
    },

    // 下一周
    nextWeek() {
        const startDate = new Date(this.data.weekStart);
        startDate.setDate(startDate.getDate() + 7);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        this.setData({
            weekStart: this.formatDate(startDate),
            weekEnd: this.formatDate(endDate)
        });

        this.loadWeekStats(startDate, endDate);
    },

    // 初始化月统计数据
    initMonthStats() {
        const today = new Date();
        const month = today.getMonth();
        const year = today.getFullYear();

        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);

        this.setData({
            currentMonth: `${year}年${month + 1}月`,
            loadingMonth: true
        });

        this.loadMonthStats(year, month);
    },
    // 加载月统计数据
    // 加载月统计数据
    loadMonthStats(year, month) {
        // 获取当前月份第一天和最后一天
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);

        // 获取当前月第一天是星期几（0-6，0代表周日）
        const firstDayOfWeek = monthStart.getDay();

        const records = app.globalData.mealRecords;
        const fastingMode = app.globalData.fastingMode;
        const expectedMeals = fastingMode === '168' ? 3 : 2;
        const durationMeals = fastingMode === '168' ? 8 : 4;

        let completedDays = 0;
        let totalDays = 0;
        const monthDays = [];

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

        // 设置当前月份
        this.setData({
            currentMonth: `${prevYear}年${prevMonth + 1}月`,
        });

        // 加载上个月的数据
        this.loadMonthStats(prevYear, prevMonth);
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

        // 设置当前月份
        this.setData({
            currentMonth: `${nextYear}年${nextMonth + 1}月`,
        });

        // 加载下个月的数据
        this.loadMonthStats(nextYear, nextMonth);
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
    }
});