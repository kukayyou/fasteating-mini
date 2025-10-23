// app.js
App({
    globalData: {
      fastingMode: '168', // 默认168断食法
      eatingStart: '09:00', // 默认开始时间
      eatingEnd: '17:00', // 默认结束时间
      mealRecords: {}, // 进餐记录（从数据库加载）
      fullMealRecords: [], // 完整云数据库记录
      reminderTimes: [], // 提醒时间点
      lastMealTime: null, // 最后一次进餐时间
      isFirstUse: true, // 标记是否首次使用
      foodApiToken: '', // 存储食物识别 API 的 Token
      openid: null,
    },
    // 事件监听器
    eventListeners: {},
    // 获取百度 AI 访问令牌
    getFoodApiToken() {
      const that = this;
  
      return new Promise((resolve, reject) => {
        wx.request({
          url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=Op2lh5R6vS0FZSuSsFB45ipi&client_secret=Feg5y9UBuZ9Z3kL9eUJWs9joHW1BEWHp`,
          method: 'POST',
          header: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          success(res) {
            if (res.data.access_token) {
              that.globalData.foodApiToken = res.data.access_token;
              resolve(res.data.access_token);
            } else {
              reject('获取 Token 失败');
            }
          },
          fail(err) {
            reject(err);
          }
        });
      });
    },
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
      wx.cloud.init({
        traceUser: true,
        env: 'cloud1-7gvnfuic7bf3a84b'
      });
      this.getOpenid().then(() => {
        this.queryMealRecords(); // 初始化时加载云数据
        this.queryUserSettings()
          .then(settings => {
            this.processUserSettings(settings);
          });
      });
      // 移除本地数据加载
      this.setupReminders();
      this.getFoodApiToken();
    },
    // 查询用户设置（从云数据库）
    queryUserSettings() {
      const db = wx.cloud.database();
      const openid = this.globalData.openid;
      if (!openid) return Promise.reject('未获取到用户信息');
  
      // 查询当前用户的设置
      return db.collection('user_settings')
        .where({
          _openid: openid
        })
        .get()
        .then(res => {
          return res.data.length > 0 ? res.data[0] : null;
        })
        .catch(err => {
          console.error('查询用户设置失败', err);
          return Promise.reject(err);
        });
    },
    // 处理用户设置（更新全局变量）
    processUserSettings(settings) {
      if (!settings) {
        console.log('未查询到用户设置，使用默认数据');
        return;
      }
      this.globalData.isFirstUse = false;
  
      // 更新全局变量（优先使用云数据库数据）
      this.globalData.fastingMode = settings.fastingMode || this.globalData.fastingMode;
      this.globalData.eatingStart = settings.eatingStart || this.globalData.eatingStart;
      this.globalData.eatingEnd = settings.eatingEnd || this.globalData.eatingEnd;
  
      // 重新计算提醒时间
      this.calculateReminderTimes();
      this.setupReminders();
  
      console.log('用户设置已从云数据库加载并更新');
      // 触发设置更新事件
      this.emit('userSettingsUpdated', {
        fastingMode: this.globalData.fastingMode,
        eatingStart: this.globalData.eatingStart,
        eatingEnd: this.globalData.eatingEnd
      });
    },
    // 获取openid（返回Promise）
    getOpenid() {
      return new Promise((resolve, reject) => {
        const cachedOpenid = wx.getStorageSync('openid');
        if (cachedOpenid) {
          this.globalData.openid = cachedOpenid;
          resolve(cachedOpenid);
          return;
        }
  
        wx.showLoading({
          title: '初始化中...',
          mask: true
        });
        wx.cloud.callFunction({
          name: 'getOpenid',
          success: res => {
            wx.hideLoading();
            if (res.result?.openid) {
              this.globalData.openid = res.result.openid;
              wx.setStorageSync('openid', res.result.openid);
              resolve(res.result.openid);
            } else {
              reject('获取openid失败');
            }
          },
          fail: err => {
            wx.hideLoading();
            reject(err);
          }
        });
      });
    },
    saveSetting() {
        // 移除本地存储保存
        this.globalData.isFirstUse = false;
        this.calculateReminderTimes();
        this.setupReminders();
        
        // 同步到云数据库
        const db = wx.cloud.database();
        const openid = this.globalData.openid;
        if (!openid) {
          console.log("openid is null")
          return;
        }
      
        const settingData = {
          fastingMode: this.globalData.fastingMode,
          eatingStart: this.globalData.eatingStart,
          eatingEnd: this.globalData.eatingEnd,
          updateTime: db.serverDate() // 记录更新时间
        };
      
        // 先查询是否已有设置记录，有则更新，无则新增
        db.collection('user_settings').where({
            _openid: openid
          }).get()
          .then(res => {
            if (res.data.length > 0) {
              // 更新现有记录
              return db.collection('user_settings')
                .doc(res.data[0]._id)
                .update({
                  data: settingData
                });
            } else {
              // 新增记录并提示用户
              return db.collection('user_settings').add({
                data: {
                  ...settingData,
                  createTime: db.serverDate(), // 记录创建时间
                  _openid: openid
                }
              }).then(addRes => {
                // 提示用户使用默认设置
                wx.showModal({
                  title: '默认设置',
                  content: '已为您默认开启168断食模式，您可以在设置页面进行修改。',
                  showCancel: false,
                  confirmText: '知道了'
                });
                return addRes;
              });
            }
          })
          .then(res => {
            console.log('用户设置已同步到云数据库', res);
          })
          .catch(err => {
            console.error('云数据库同步设置失败', err);
          });
      },
    // 从云数据库查询用餐记录
    queryMealRecords() {
      const db = wx.cloud.database();
      const openid = this.globalData.openid;
      if (!openid) return Promise.reject('未获取到用户信息');
  
      return db.collection('meal_records')
        .where({
          _openid: openid
        })
        .orderBy('createTime', 'desc')
        .get()
        .then(res => {
          this.globalData.fullMealRecords = res.data;
          
          // 格式化记录为按日期存储
          const mealRecords = {};
          res.data.forEach(record => {
            if (!mealRecords[record.date]) {
              mealRecords[record.date] = [];
            }
            mealRecords[record.date].push(record.time);
            
            // 按时间排序
            mealRecords[record.date].sort((a, b) => {
              return a.localeCompare(b);
            });
          });
          
          this.globalData.mealRecords = mealRecords;
          this.emit('mealRecordsUpdated', mealRecords);
          return res.data;
        })
        .catch(err => {
          console.error('查询用餐记录失败', err);
          return Promise.reject(err);
        });
    },
  
    // 新增用餐记录到云数据库
    addMealRecord(time) {
      const db = wx.cloud.database();
      const openid = this.globalData.openid;
      if (!openid) return Promise.reject('未获取到用户信息');
  
      const today = new Date().toISOString().split('T')[0];
      const formattedTime = time || `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;
  
      return db.collection('meal_records').add({
        data: {
          time: formattedTime,
          date: today,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
          fastingMode: this.globalData.fastingMode
        }
      }).then(res => {
        // 更新全局数据
        if (!this.globalData.mealRecords[today]) this.globalData.mealRecords[today] = [];
        this.globalData.mealRecords[today].push(formattedTime);
        this.globalData.mealRecords[today].sort((a, b) => a.localeCompare(b));
        
        this.globalData.fullMealRecords.unshift({
          _id: res._id,
          time: formattedTime,
          date: today,
          _openid: openid
        });
        
        this.globalData.lastMealTime = formattedTime;
        this.emit('mealRecordsUpdated', this.globalData.mealRecords);
        return res;
      }).catch(err => {
        console.error('新增用餐记录失败', err);
        return Promise.reject(err);
      });
    },
  
    // 更新用餐记录
    updateMealRecord(recordId, newTime) {
      const db = wx.cloud.database();
      const openid = this.globalData.openid;
      if (!recordId || !openid) return Promise.reject('参数错误');
  
      return db.collection('meal_records')
        .where({
          _id: recordId,
          _openid: openid
        })
        .update({
          data: {
            time: newTime,
            updateTime: db.serverDate()
          }
        }).then(res => {
          if (res.stats.updated > 0) {
            const index = this.globalData.fullMealRecords.findIndex(r => r._id === recordId);
            if (index !== -1) {
              const oldTime = this.globalData.fullMealRecords[index].time;
              const date = this.globalData.fullMealRecords[index].date;
              // 更新完整记录
              this.globalData.fullMealRecords[index].time = newTime;
              // 更新格式化记录
              if (this.globalData.mealRecords[date]) {
                const timeIndex = this.globalData.mealRecords[date].indexOf(oldTime);
                if (timeIndex !== -1) {
                  this.globalData.mealRecords[date][timeIndex] = newTime;
                  this.globalData.mealRecords[date].sort((a, b) => a.localeCompare(b));
                  this.emit('mealRecordsUpdated', this.globalData.mealRecords);
                }
              }
            }
          }
          return res;
        }).catch(err => {
          console.error('更新用餐记录失败', err);
          return Promise.reject(err);
        });
    },
  
    // 删除用餐记录
    deleteMealRecord(recordId) {
      const db = wx.cloud.database();
      const openid = this.globalData.openid;
      if (!recordId || !openid) return Promise.reject('参数错误');
  
      // 先找到要删除的记录信息
      const recordIndex = this.globalData.fullMealRecords.findIndex(r => r._id === recordId);
      if (recordIndex === -1) return Promise.reject('记录不存在');
      
      const record = this.globalData.fullMealRecords[recordIndex];
  
      return db.collection('meal_records')
        .where({
          _id: recordId,
          _openid: openid
        })
        .remove()
        .then(res => {
          if (res.stats.removed > 0) {
            // 更新全局数据
            this.globalData.fullMealRecords.splice(recordIndex, 1);
            
            if (this.globalData.mealRecords[record.date]) {
              const timeIndex = this.globalData.mealRecords[record.date].indexOf(record.time);
              if (timeIndex !== -1) {
                this.globalData.mealRecords[record.date].splice(timeIndex, 1);
                // 如果日期数组为空，删除该日期
                if (this.globalData.mealRecords[record.date].length === 0) {
                  delete this.globalData.mealRecords[record.date];
                }
                this.emit('mealRecordsUpdated', this.globalData.mealRecords);
              }
            }
          }
          return res;
        }).catch(err => {
          console.error('删除用餐记录失败', err);
          return Promise.reject(err);
        });
    },
    
    // 计算提醒时间
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
    
    // 设置提醒
    setupReminders() {
      // 提醒逻辑实现
      console.log('提醒已设置:', this.globalData.reminderTimes);
    }
  });