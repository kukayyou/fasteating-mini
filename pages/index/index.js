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
  },

  onLoad() {
    // 监听全局数据更新
    app.on('userSettingsUpdated', this.handleSettingsUpdate.bind(this));
    app.on('mealRecordsUpdated', this.handleMealRecordsUpdate.bind(this));
  },

  onShow() {
    // 从全局数据更新页面
    this.setData({
      fastingMode: app.globalData.fastingMode,
      eatingStart: app.globalData.eatingStart,
      eatingEnd: app.globalData.eatingEnd,
    });
    
    // 加载今日用餐记录
    this.loadTodayMeals();
    // 更新断食状态
    this.updateFastingStatus();
  },

  onUnload() {
    // 移除事件监听
    app.off('userSettingsUpdated', this.handleSettingsUpdate);
    app.off('mealRecordsUpdated', this.handleMealRecordsUpdate);
    
    if (this.data.pageInitTimer) {
      clearTimeout(this.data.pageInitTimer);
    }
  },

  // 处理设置更新
  handleSettingsUpdate(settings) {
    this.setData({
      fastingMode: settings.fastingMode,
      eatingStart: settings.eatingStart,
      eatingEnd: settings.eatingEnd
    });
    this.updateFastingStatus();
  },

  // 处理用餐记录更新
  handleMealRecordsUpdate(mealRecords) {
    this.loadTodayMeals();
  },

  // 加载今日用餐记录
  loadTodayMeals() {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = app.globalData.mealRecords[today] || [];
    this.setData({ todayMeals });
  },

  // 更新断食状态
  updateFastingStatus() {
    // 实现断食状态更新逻辑
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
      // 同一天内
      isFasting = currentTime < startTime || currentTime > endTime;
    } else {
      // 跨天
      isFasting = currentTime < startTime && currentTime > endTime;
    }
    
    // 计算进度和剩余时间
    let progress = 0;
    let remainingTime = 0;
    
    if (!isFasting) {
      // 进食期间
      const totalMinutes = startTime < endTime ? endTime - startTime : (24*60 - startTime) + endTime;
      const elapsedMinutes = startTime < endTime ? currentTime - startTime : (24*60 - startTime) + currentTime;
      progress = ((elapsedMinutes / totalMinutes) * 100).toFixed(1);
      remainingTime = ((totalMinutes - elapsedMinutes) / 60).toFixed(1);
    } else {
      // 断食期间
      const totalMinutes = 24*60 - (startTime < endTime ? endTime - startTime : (24*60 - startTime) + endTime);
      const elapsedMinutes = startTime < endTime ? 
        (currentTime < startTime ? currentTime + (24*60 - endTime) : currentTime - endTime) :
        currentTime - endTime;
      
      progress = ((elapsedMinutes / totalMinutes) * 100).toFixed(1);
      remainingTime = ((totalMinutes - elapsedMinutes) / 60).toFixed(1);
    }
    
    this.setData({
      isFasting,
      progress,
      remainingTime
    });
  },

  // 图片加载失败处理
  onFoodImageError(e) {
    const index = e.currentTarget.dataset.index;
    const defaultImg = '/images/food-placeholder.png';
    const recognizedFoods = [...this.data.recognizedFoods];

    if (index !== undefined && index !== null) {
      if (recognizedFoods[index]?.imageUrl !== defaultImg) {
        recognizedFoods[index].imageUrl = defaultImg;
        this.setData({ recognizedFoods });
      }
    } else if (this.data.recognizedFood.imageUrl !== defaultImg) {
      const updatedFood = { ...this.data.recognizedFood, imageUrl: defaultImg };
      this.setData({ recognizedFood: updatedFood });
    }

    wx.showToast({
      title: '图片加载失败，已显示默认图',
      icon: 'none',
      duration: 3000
    });
  },

  // Base64转临时文件
  base64ToTempFile(base64Data, mimeType) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      const ext = mimeType.split('/')[1];
      const tempFilePath = `${wx.env.USER_DATA_PATH}/${Date.now()}.${ext}`;

      try {
        const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = wx.base64ToArrayBuffer(base64);

        fs.writeFile({
          filePath: tempFilePath,
          data: buffer,
          encoding: 'binary',
          success() { resolve(tempFilePath); },
          fail(err) { reject(err); }
        });
      } catch (err) {
        reject(err);
      }
    });
  },

  // 拍照或选择图片
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
        const fileExt = tempFilePath.split('.').pop().toLowerCase();
        const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

        that.setData({ takenImagePath: tempFilePath });

        that.imageToBase64(tempFilePath)
          .then(base64 => that.recognizeFoodByApi(base64, mimeType))
          .catch(err => {
            wx.showToast({ title: '图片处理失败', icon: 'none' });
          });
      }
    });
  },

  // 图片转Base64
  imageToBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success(res) { resolve(res.data); },
        fail(err) { reject(err); }
      });
    });
  },

  // 调用第三方API识别食物
  recognizeFoodByApi(base64Image, mimeType = 'image/jpeg') {
    const that = this;
    const app = getApp();

    const getToken = app.globalData.foodApiToken ?
      Promise.resolve(app.globalData.foodApiToken) :
      app.getFoodApiToken();

    getToken.then(token => {
      wx.showLoading({ title: '识别中...' });
      wx.request({
        url: `https://aip.baidubce.com/rest/2.0/image-classify/v2/dish?access_token=${token}`,
        method: 'POST',
        header: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: { image: base64Image, baike_num: 1 },
        success(res) {
          wx.hideLoading();
          if (res.data.error_code) {
            wx.showToast({ title: `识别失败：${res.data.error_msg}`, icon: 'none' });
            return;
          }

          const results = res.data.result || [];
          if (results.length === 0) {
            wx.showToast({ title: '未识别到食物', icon: 'none' });
            return;
          }

          const formattedResults = results.map(item => ({
            name: item.name || '未知食物',
            probability: (item.probability * 100).toFixed(1),
            calories: item.has_calorie ? `${item.calorie} 大卡/100g` : '未提供',
            baikeUrl: item.baike_info?.baike_url || '',
            imageUrl: item.baike_info?.image_url || '/images/food-placeholder.png',
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
        fail(err) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        }
      });
    }).catch(err => {
      wx.showToast({ title: '获取授权失败', icon: 'none' });
    });
  },

  // 切换选中的食物
  selectFood(index) {
    const selectedFood = this.data.recognizedFoods[index];
    this.setData({
      selectedFoodIndex: index,
      recognizedFood: selectedFood,
      dietAdvice: this.generateDietAdvice(selectedFood)
    });
  },

  // 模拟AI识别食物
  recognizeFood(imagePath) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockFoods = [
          { name: '烤鸡胸肉', calories: 165, protein: 31, carbs: 0, fat: 3.6, description: '富含优质蛋白的健康食品' },
          { name: '沙拉', calories: 50, protein: 2, carbs: 7, fat: 2, description: '多种蔬菜混合的低卡食物' },
          { name: '米饭', calories: 130, protein: 2.6, carbs: 28, fat: 0.3, description: '碳水化合物的主要来源' },
          { name: '煎蛋', calories: 90, protein: 6, carbs: 0.6, fat: 7, description: '含有丰富蛋白质和脂肪' }
        ];
        resolve(mockFoods[Math.floor(Math.random() * mockFoods.length)]);
      }, 1500);
    });
  },

  // 生成用餐建议
  generateDietAdvice(food) {
    const { isFasting, fastingMode } = this.data;
    const { name, calories, description, hasNutrition } = food;

    if (isFasting) {
      return `当前处于断食期，建议避免进食。识别到的食物为${name}，请遵守断食计划哦~`;
    }

    let baseAdvice = '';
    if (description) {
      if (description.includes('鸡蛋') || description.includes('虾仁') || description.includes('蛋白')) {
        baseAdvice = `${name}含有优质蛋白，`;
      } else if (description.includes('蔬菜') || description.includes('沙拉')) {
        baseAdvice = `${name}富含膳食纤维，`;
      } else if (description.includes('米饭') || description.includes('碳水')) {
        baseAdvice = `${name}碳水化合物含量较高，`;
      }
    }

    if (!baseAdvice) {
      baseAdvice = `${name}的营养成分适合合理搭配，`;
    }

    if (hasNutrition) {
      if (fastingMode === '168') {
        return `${baseAdvice}${calories}，适合16:8模式，建议控制总量并搭配蔬菜。`;
      } else {
        return `${baseAdvice}20:4模式下，${calories}需计入每日总量，建议适量食用。`;
      }
    } else {
      if (fastingMode === '168') {
        const isVegetable = ['葱', '蒜', '青菜', '萝卜'].some(veg => name.includes(veg));
        const isFruit = ['苹果', '香蕉', '橙子'].some(fruit => name.includes(fruit));

        if (isVegetable) {
          return `16:8模式下，${name}作为蔬菜适合多吃，可搭配优质蛋白（如鸡蛋、瘦肉）。`;
        } else if (isFruit) {
          return `16:8模式中，${name}可作为加餐，建议在进食窗口内适量食用。`;
        } else {
          return `16:8模式下，建议控制${name}的食用量，保持三餐规律间隔。`;
        }
      } else {
        return `20:4模式进食窗口较短，${name}建议搭配其他营养食材（如蛋白质、健康脂肪），均衡一餐营养。`;
      }
    }
  },

  // 保存食物记录
  saveFoodRecord() {
    if (this.data.isRecording) return;
    this.setData({ isRecording: true });

    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const mealTime = `${hours}:${minutes}`;

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
            this.setData({ isRecording: false });
          }
        }
      });
    } else {
      this.actuallySaveRecord(mealTime);
    }
  },

  // 实际保存记录
  actuallySaveRecord(mealTime) {
    app.addMealRecord(mealTime)
      .then(() => {
        this.setData({
          isRecording: false,
          showFoodResult: false,
          mealActionFeedback: '用餐记录已保存',
          showMealActionToast: true
        });
        
        setTimeout(() => {
          this.setData({ showMealActionToast: false });
        }, 2000);
      })
      .catch(err => {
        console.error('保存用餐记录失败', err);
        this.setData({ isRecording: false });
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      });
  },

  // 记录当前时间进餐
  recordMealNow() {
    if (this.data.isRecording) return;
    this.setData({ isRecording: true });

    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const mealTime = `${hours}:${minutes}`;

    if (this.data.isFasting) {
      wx.showModal({
        title: '断食期提醒',
        content: '当前处于断食期，确定要记录用餐吗？',
        confirmText: '确定',
        cancelText: '取消',
        success: res => {
          if (res.confirm) {
            this.saveMealTime(mealTime);
          } else {
            this.setData({ isRecording: false });
          }
        }
      });
    } else {
      this.saveMealTime(mealTime);
    }
  },

  // 保存用餐时间
  saveMealTime(mealTime) {
    app.addMealRecord(mealTime)
      .then(() => {
        this.setData({
          isRecording: false,
          mealActionFeedback: '已记录当前进餐时间',
          showMealActionToast: true
        });
        
        setTimeout(() => {
          this.setData({ showMealActionToast: false });
        }, 2000);
      })
      .catch(err => {
        console.error('记录用餐失败', err);
        this.setData({ isRecording: false });
        wx.showToast({ title: '记录失败，请重试', icon: 'none' });
      });
  },

  // 显示时间选择器
  showTimePicker(e) {
    const index = e.currentTarget.dataset.index;
    const today = new Date().toISOString().split('T')[0];
    const mealRecords = app.globalData.mealRecords[today] || [];
    
    this.setData({
      showPicker: true,
      editingIndex: index,
      selectedTime: mealRecords[index] || '12:00'
    });
  },

  // 隐藏时间选择器
  hidePicker() {
    this.setData({ showPicker: false, editingIndex: -1 });
  },

  // 时间选择变化
  timeChange(e) {
    this.setData({ selectedTime: e.detail.value });
  },

  // 更新用餐时间
  updateMealTime() {
    const { editingIndex, selectedTime } = this.data;
    const today = new Date().toISOString().split('T')[0];
    const mealRecords = app.globalData.mealRecords[today] || [];
    
    if (editingIndex === -1 || editingIndex >= mealRecords.length) {
      this.hidePicker();
      return;
    }
    
    const oldTime = mealRecords[editingIndex];
    // 找到对应的完整记录ID
    const recordId = app.globalData.fullMealRecords.find(
      r => r.date === today && r.time === oldTime
    )?._id;
    
    if (!recordId) {
      wx.showToast({ title: '未找到记录', icon: 'none' });
      this.hidePicker();
      return;
    }
    
    app.updateMealRecord(recordId, selectedTime)
      .then(() => {
        this.setData({
          mealActionFeedback: '用餐时间已更新',
          showMealActionToast: true
        });
        this.hidePicker();
        
        setTimeout(() => {
          this.setData({ showMealActionToast: false });
        }, 2000);
      })
      .catch(err => {
        console.error('更新用餐时间失败', err);
        wx.showToast({ title: '更新失败，请重试', icon: 'none' });
      });
  },

  // 删除用餐记录
  deleteMeal(e) {
    const index = e.currentTarget.dataset.index;
    const today = new Date().toISOString().split('T')[0];
    const mealRecords = app.globalData.mealRecords[today] || [];
    
    if (index >= mealRecords.length) return;
    
    const time = mealRecords[index];
    // 找到对应的完整记录ID
    const recordId = app.globalData.fullMealRecords.find(
      r => r.date === today && r.time === time
    )?._id;
    
    if (!recordId) {
      wx.showToast({ title: '未找到记录', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${time} 的用餐记录吗？`,
      confirmText: '删除',
      cancelText: '取消',
      success: res => {
        if (res.confirm) {
          app.deleteMealRecord(recordId)
            .then(() => {
              this.setData({
                mealActionFeedback: '用餐记录已删除',
                showMealActionToast: true
              });
              
              setTimeout(() => {
                this.setData({ showMealActionToast: false });
              }, 2000);
            })
            .catch(err => {
              console.error('删除用餐记录失败', err);
              wx.showToast({ title: '删除失败，请重试', icon: 'none' });
            });
        }
      }
    });
  },

  // 关闭食物识别结果
  closeFoodResult() {
    this.setData({ showFoodResult: false });
  },

  // 导航到设置页面
  navigateToSetting() {
    wx.navigateTo({ url: '/pages/setting/setting' });
  },

  // 获取用餐类型
  getMealType(index) {
    const { fastingMode } = this.data;
    if (fastingMode === '168') {
      return ['早餐', '午餐', '晚餐'][index] || `加餐${index - 2}`;
    } else {
      return ['第一餐', '第二餐'][index] || `加餐${index - 1}`;
    }
  }
});