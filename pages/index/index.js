// pages/index/index.js
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
        showPicker: false,
        selectedTime: '12:00',
        editingIndex: -1,
        showFoodResult: false,
        recognizedFood: {},
        recognizedFoods: [],
        selectedFoodIndex: 0,
        dietAdvice: '',
        foodApiToken: '',
        isRecording: false,
        isTakingPhoto: false,
        mealActionFeedback: '',
        showMealActionToast: false,
        takenImagePath: '',
        pageInitTimer: null,
        circleRadius: 240,
        eatingStartAngle: 0,
        eatingEndAngle: 0,
        currentTimeAngle: 0,
        currentHour: 0,
        currentMinute: 0,
        hours: []
    },
    // 分享到微信好友/群聊
    onShareAppMessage() {
        return {
            title: '我正在使用断食计划管理工具，一起来健康饮食吧！',
            path: '/pages/index/index', // 分享后打开的页面路径
            imageUrl: '/images/share-friend.png' // 分享时显示的图片
        }
    },

    // 分享到朋友圈
    onShareTimeline() {
        return {
            title: '科学断食，健康生活！推荐你使用这款断食计划管理工具',
            query: 'from=timeline', // 分享携带的参数
            imageUrl: '/images/share-friend.png' // 分享时显示的图片
        }
    },
    onLoad() {
        app.on('userSettingsUpdated', this.handleSettingsUpdate.bind(this));
        app.on('mealRecordsUpdated', this.handleMealRecordsUpdate.bind(this));
        this.startTimeUpdate();
    },

    onShow() {
        this.setData({
            fastingMode: app.globalData.fastingMode,
            eatingStart: app.globalData.eatingStart,
            eatingEnd: app.globalData.eatingEnd,
        });
        this.loadTodayMeals();
        this.updateFastingStatus();
        this.initTimelineData();
    },

    onUnload() {
        app.off('userSettingsUpdated', this.handleSettingsUpdate);
        app.off('mealRecordsUpdated', this.handleMealRecordsUpdate);
        if (this.data.pageInitTimer) clearTimeout(this.data.pageInitTimer);
        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
    },

    startTimeUpdate() {
        this.timeUpdateInterval = setInterval(() => {
            this.updateFastingStatus();
            this.initTimelineData();
        }, 60000); // 每分钟更新一次
    },

    handleSettingsUpdate(settings) {
        this.setData({
            fastingMode: settings.fastingMode,
            eatingStart: settings.eatingStart,
            eatingEnd: settings.eatingEnd
        });
        this.updateFastingStatus();
        this.initTimelineData();
    },

    handleMealRecordsUpdate(mealRecords) {
        this.loadTodayMeals();
    },

    loadTodayMeals() {
        const today = new Date().toISOString().split('T')[0];
        // 从完整记录中筛选今日数据，并保留_id
        const todayFullMeals = app.globalData.fullMealRecords
            .filter(record => record.date === today)
            .sort((a, b) => a.time.localeCompare(b.time)); // 按时间排序
        console.log("todayFullMeals:", todayFullMeals)
        // 转换为包含id和time的数组
        const todayMeals = todayFullMeals.map(item => ({
            id: item._id, // 数据库记录唯一标识
            time: item.time
        }));

        this.setData({
            todayMeals
        });
    },

    updateFastingStatus() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        const [startHour, startMinute] = this.data.eatingStart.split(':').map(Number);
        const [endHour, endMinute] = this.data.eatingEnd.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        let isFasting = false;
        if (startTime < endTime) {
            isFasting = currentTime < startTime || currentTime > endTime;
        } else {
            isFasting = currentTime < startTime && currentTime > endTime;
        }

        let progress = 0;
        let remainingTime = 0;
        if (!isFasting) {
            const totalMinutes = startTime < endTime ? endTime - startTime : (24 * 60 - startTime) + endTime;
            const elapsedMinutes = startTime < endTime ? currentTime - startTime : (24 * 60 - startTime) + currentTime;
            progress = ((elapsedMinutes / totalMinutes) * 100).toFixed(1);
            remainingTime = ((totalMinutes - elapsedMinutes) / 60).toFixed(1);
        } else {
            const totalMinutes = 24 * 60 - (startTime < endTime ? endTime - startTime : (24 * 60 - startTime) + endTime);
            const elapsedMinutes = startTime < endTime ?
                (currentTime < startTime ? currentTime + (24 * 60 - endTime) : currentTime - endTime) :
                currentTime - endTime;
            progress = ((elapsedMinutes / totalMinutes) * 100).toFixed(1);
            remainingTime = ((totalMinutes - elapsedMinutes) / 60).toFixed(1);
        }

        this.setData({
            isFasting,
            progress,
            remainingTime,
            currentHour,
            currentMinute
        });
    },

    initTimelineData() {
        const hours = [0, 6, 12, 18].map(hour => ({
            hour,
            percent: (hour / 24) * 100
        }));

        const [startHour, startMinute] = this.data.eatingStart.split(':').map(Number);
        const [endHour, endMinute] = this.data.eatingEnd.split(':').map(Number);
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;

        let eatingStartAngle, eatingEndAngle;
        if (startTotalMinutes < endTotalMinutes) {
            eatingStartAngle = (startTotalMinutes / (24 * 60)) * 360;
            eatingEndAngle = (endTotalMinutes / (24 * 60)) * 360;
        } else {
            eatingStartAngle = (startTotalMinutes / (24 * 60)) * 360;
            eatingEndAngle = (endTotalMinutes / (24 * 60)) * 360 + 360;
        }

        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        const currentTimeAngle = (currentTotalMinutes / (24 * 60)) * 360;

        this.setData({
            hours,
            eatingStartAngle,
            eatingEndAngle,
            currentTimeAngle
        });
    },

    getEatingEndPoint() {
        const endAngle = this.data.eatingEndAngle % 360;
        const radians = endAngle * Math.PI / 180;
        const x = 50 + 50 * Math.cos(radians - Math.PI / 2);
        const y = 50 + 50 * Math.sin(radians - Math.PI / 2);
        return `${x}% ${y}%`;
    },

    getMealType(index) {
        const types = ['早餐', '午餐', '晚餐', '加餐'];
        return types[index % types.length];
    },

    showTimePicker(e) {
        const index = e.currentTarget.dataset.index;
        const mealItem = this.data.todayMeals[index]; // 获取当前餐食对象（含id和time）
        if (!mealItem) {
            wx.showToast({
                title: '记录不存在',
                icon: 'none'
            });
            return;
        }
        this.setData({
            showPicker: true,
            selectedTime: mealItem.time, // 正确获取时间字符串
            editingIndex: index
        });
    },

    hidePicker() {
        this.setData({
            showPicker: false
        });
    },

    timeChange(e) {
        this.setData({
            selectedTime: e.detail.value
        });
    },

    updateMealTime() {
        const {
            editingIndex,
            todayMeals,
            selectedTime
        } = this.data;
        // 校验索引有效性
        if (editingIndex === -1 || !todayMeals[editingIndex]) {
            wx.showToast({
                title: '记录不存在',
                icon: 'none'
            });
            return;
        }

        // 获取对应的recordId（数据库中的_id）
        const recordId = todayMeals[editingIndex].id;
        if (!recordId) {
            wx.showToast({
                title: '无法获取记录ID',
                icon: 'none'
            });
            return;
        }

        // 调用更新方法，传入recordId和新时间
        app.updateMealRecord(recordId, selectedTime)
            .then(() => {
                this.setData({
                    showPicker: false
                });
                wx.showToast({
                    title: '记录已更新'
                });
            })
            .catch(err => {
                console.error('更新失败', err);
                wx.showToast({
                    title: '更新失败，请重试',
                    icon: 'none'
                });
            });
    },

    deleteMeal(e) {
        const index = e.currentTarget.dataset.index;
        const {
            todayMeals
        } = this.data;

        if (!todayMeals[index]) {
            wx.showToast({
                title: '记录不存在',
                icon: 'none'
            });
            return;
        }

        const recordId = todayMeals[index].id;
        app.deleteMealRecord(recordId)
            .then(() => {
                wx.showToast({
                    title: '记录已删除'
                });
            })
            .catch(err => {
                console.error('删除失败', err);
                wx.showToast({
                    title: '删除失败，请重试',
                    icon: 'none'
                });
            });
    },

    recordMealNow() {
        if (this.data.isRecording) return;
        this.setData({
            isRecording: true
        });

        const now = new Date();
        const mealTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (this.data.isFasting) {
            wx.showModal({
                title: '断食期提醒',
                content: '当前处于断食期，确定要记录用餐吗？',
                confirmText: '确定',
                cancelText: '取消',
                success: res => {
                    if (res.confirm) {
                        this.actuallySaveRecord(mealTime);
                    } else {
                        this.setData({
                            isRecording: false
                        });
                    }
                }
            });
        } else {
            this.actuallySaveRecord(mealTime);
        }
    },

    takeFoodPhoto() {
        const that = this;
        wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['camera', 'album'],
            maxWidth: 300,
            maxHeight: 300,
            success(res) {
                const tempFilePath = res.tempFilePaths[0];
                that.setData({
                    takenImagePath: tempFilePath
                });
                that.imageToBase64(tempFilePath)
                    .then(base64 => that.recognizeFoodByApi(base64))
                    .catch(() => wx.showToast({
                        title: '图片处理失败',
                        icon: 'none'
                    }));
            }
        });
    },

    imageToBase64(filePath) {
        return new Promise((resolve, reject) => {
            wx.getFileSystemManager().readFile({
                filePath,
                encoding: 'base64',
                success: (res) => resolve(res.data),
                fail: (err) => reject(err)
            });
        });
    },

    recognizeFoodByApi(base64Image) {
        const that = this;
        const app = getApp();

        const getToken = app.globalData.foodApiToken ?
            Promise.resolve(app.globalData.foodApiToken) :
            app.getFoodApiToken();

        getToken.then(token => {
            wx.showLoading({
                title: '识别中...'
            });
            wx.request({
                url: `https://aip.baidubce.com/rest/2.0/image-classify/v2/dish?access_token=${token}`,
                method: 'POST',
                header: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    image: base64Image,
                    baike_num: 1
                },
                success(res) {
                    wx.hideLoading();
                    if (res.data.error_code) {
                        wx.showToast({
                            title: `识别失败：${res.data.error_msg}`,
                            icon: 'none'
                        });
                        return;
                    }
                    const results = res.data.result || [];
                    if (results.length === 0) {
                        wx.showToast({
                            title: '未识别到食物',
                            icon: 'none'
                        });
                        return;
                    }
                    const formattedResults = results.map(item => ({
                        name: item.name || '未知食物',
                        probability: (item.probability * 100).toFixed(1),
                        calories: item.has_calorie ? `${item.calorie} 大卡/100g` : '未提供',
                        description: item.baike_info?.description || '',
                        hasNutrition: item.has_calorie
                    }));
                    that.setData({
                        showFoodResult: true,
                        recognizedFoods: formattedResults,
                        selectedFoodIndex: 0,
                        recognizedFood: formattedResults[0],
                        dietAdvice: that.generateDietAdvice(formattedResults[0])
                    });
                },
                fail() {
                    wx.hideLoading();
                    wx.showToast({
                        title: '网络错误，请重试',
                        icon: 'none'
                    });
                }
            });
        }).catch(() => wx.showToast({
            title: '获取授权失败',
            icon: 'none'
        }));
    },

    selectFood(e) {
        const index = e.currentTarget.dataset.index;
        const selectedFood = this.data.recognizedFoods[index];
        this.setData({
            selectedFoodIndex: index,
            recognizedFood: selectedFood,
            dietAdvice: this.generateDietAdvice(selectedFood)
        });
    },

    generateDietAdvice(food) {
        const {
            isFasting,
            fastingMode
        } = this.data;
        if (isFasting) {
            return `当前处于断食期，建议避免进食。识别到的食物为${food.name}，请遵守断食计划哦~`;
        }
        let baseAdvice = `${food.name}的营养成分适合合理搭配，`;
        if (food.description) {
            if (food.description.includes('鸡蛋') || food.description.includes('虾仁')) {
                baseAdvice = `${food.name}含有优质蛋白，`;
            } else if (food.description.includes('蔬菜') || food.description.includes('沙拉')) {
                baseAdvice = `${food.name}富含膳食纤维，`;
            }
        }
        return fastingMode === '168' ?
            `${baseAdvice}适合16:8模式，建议控制总量并搭配蔬菜。` :
            `${baseAdvice}20:4模式下需计入每日总量，建议适量食用。`;
    },

    saveFoodRecord() {
        if (this.data.isRecording) return;
        this.setData({
            isRecording: true
        });
        const now = new Date();
        const mealTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        this.actuallySaveRecord(mealTime);
    },

    actuallySaveRecord(mealTime) {
        app.addMealRecord(mealTime)
            .then(() => {
                this.setData({
                    isRecording: false,
                    showFoodResult: false,
                    mealActionFeedback: '用餐记录已保存',
                    showMealActionToast: true
                });
                setTimeout(() => this.setData({
                    showMealActionToast: false
                }), 2000);
            })
            .catch(() => {
                this.setData({
                    isRecording: false
                });
                wx.showToast({
                    title: '保存失败，请重试',
                    icon: 'none'
                });
            });
    },

    showToast(message) {
        this.setData({
            mealActionFeedback: message,
            showMealActionToast: true
        });
        setTimeout(() => this.setData({
            showMealActionToast: false
        }), 2000);
    },

    closeFoodResult() {
        this.setData({
            showFoodResult: false
        });
    },

    onFoodImageError() {
        wx.showToast({
            title: '图片加载失败',
            icon: 'none'
        });
    }
});