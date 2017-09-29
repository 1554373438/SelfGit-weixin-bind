(function() {
  var HOST = /nonobank.com/.test(location.host) ? (location.protocol + '//' + location.host + (location.port ? ':' + location.port : '')) : "https://m.stb.nonobank.com";

  var am_id = getSearch()['am_id'] || '',
      approach = getSearch()['approach'] || '',
      approach2 = getSearch()['approach2'] || '',
      approach3 = getSearch()['approach3'] || '';
  var $http, uuid, openId,
      timer = null,
      codeSentTime = 0,
      tokenId = localStorage.getItem('tongdun_token');

  var errortype = 0; //0: 无错 1、手机号错误 2、验证码错误 3、手机号已经注册

  Vue.directive('focus', {
    inserted: function(el, binding) {
      if (binding.value) {
        el.focus();
      }
    },
    componentUpdated: function(el, binding) {
      if (binding.modifiers.lazy) {
        if (Boolean(binding.value) === Boolean(binding.oldValue)) {
          return;
        }
      }
      if (binding.value) {
        el.focus();
      }
    },
  })

  var vm = new Vue({
    el: '#app',
    data: {
      user: {
        phone: '',
        codeMsg: '',
        agreement: true,
        autobuild: true
      },
      isbind:false,
      btnActive: false,
      nonoActive:false,
      caishenActive:false,
      timeCount: -1,
      focusStatus: 0, //1、图形验证码聚焦  2、短信验证码聚焦 3、手机号聚焦
      isLoading: false,
      toastMsg: ''
    },
    watch: {
      'user.phone': function(val, oldval) {
        if (val.length == 11) {
          vm.btnActive = true;
        }else{
          vm.btnActive = false;
        }
      }      
    },
    methods: {
      init: function() {
        $http = new http();
        vm.getTime(vm.getOpenID);
      },

      checkBind:function(openId){
        var params = {
          openId: openId,
          oa: 'mzqbj'
        };
        $http.get('/user/wechat-oa-bind-info', {params: params}, {loading:true}).then(function(res) {
          if(res.succeed){
            if(res.data == 0){
              location.href = 'success.html';
              return;
            }
            vm.isbind = true;
          } else {
            vm.toastMsg = res.errorMessage;
          }
        });
      },

      getOpenID:function(){
        var REDIRECT_URI = encodeURIComponent(HOST + "/maizi/weixin-bind/bind.html");
        var type = 'mzqbj';
        var paramsAppId = {
          type: type
        };
        var code = getSearch()['code'] || '';
        if(code){
          debugger;
        }else{
          $http.get('/wechat/appid', { params: paramsAppId }).then(function(res) {
            var APPID = res.appId;
            debugger;
            window.location.href = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=" + APPID + "&redirect_uri=" + REDIRECT_URI + "&response_type=code&scope=snsapi_base&state=1#wechat_redirect";
          });
        }
        var paramsOpenId = {
          type: type,
          code: code
        };
        $http.post('/wechat/access_token', paramsOpenId, {loading: true}).then(function(res) {
          openId = res.openid;
          sessionStorage.setItem('open-id', openId);
          if(openId){
            vm.checkBind(openId);
          };
        });
      },

      getTime: function(callback) {
        $http.get('/common/current', { isTime: true }).then(function(res) {
          if (res && res.succeed) {
            vm.setTime(res.data.timestamp);
            callback();
          }
        });
      },

      setTime: function(timeSys) {
        var offsetTime = timeSys - Date.now();
        setSession('landing-offsetTime', offsetTime);
      },

      checkPhone: function() {
        var req = /1[345789]\d{9}$/;
        if (!this.user.phone.length) {
          this.toastMsg = '请输入用户名';
          errortype = 1;
          return;
        }
        if (!req.test(this.user.phone)) {
          this.toastMsg = '请输入正确格式的手机号码';
          errortype = 1;
          return;
        }
      },

      hide: function() {
        this.toastMsg = '';
      },

      countDown: function(t) { //倒计时
        this.focusStatus = 0;
        if (t >= 0) {
          vm.timeCount = t;
          t--;
          timer = setTimeout(function() {
            vm.countDown(t);
          }, 1000);
        }
      },

      checkPhoneReg :function(){
        vm.checkPhone();
        var val = this.user.phone;
        if(val.length == 11){
          errortype = 0
          $http.get('/common/check/mobile/' + val).then(function(res) {
            if (res.succeed) {
              if (res.data.exists == 1) {
                vm.focusStatus = 2;
                errortype = 3;
                vm.getCode();
              } else {
                vm.toastMsg = '您尚未注册，请先注册账户';
                errortype = 0;
                vm.focusStatus = 0;
              }
            } else {
              vm.toastMsg = res.errorMessage;
            }
          });
        }
      },

      getCode: function() {
        var params = {
          mobile: vm.user.phone,
          codeType: 1,
          tokenId: tokenId
        }
        $http.post('/user/v-code', params).then(function(res) {
          if (res.succeed) {
            // codeSentTime += 1;
            vm.btnActive = true;
            vm.timeCount = 60;
            vm.countDown(vm.timeCount);
            setTimeout(function() {
              vm.focusStatus = 2;
            }, 1000);
          } else {
            vm.btnActive = false;
            vm.toastMsg= res.errorMessage;
            // codeSentTime = 0;
            vm.focusStatus = 2;
          }
        });
      },

      doLogin: function(){
        var params = {
          loginType:1,
          username: vm.user.phone,
          vcode: vm.user.codeMsg,
          tokenId: tokenId
        }
        $http.post('/user/login', params, {loading:true}).then(function(res) {
          if (res.succeed) {
            var jwt = res.data.jwt;
            sessionStorage.setItem('bind-jwt', jwt);
            vm.bindWechat();
          } else if (res.errorCode == '0100154') {
            vm.btnActive = false;
            vm.toastMsg = '短信验证码输入有误';
          } else {
            vm.btnActive = false;
            vm.toastMsg = res.errorMessage;
          }
        });
      },

      bindWechat:function(){
        var params = {
          openId: openId,
          oa: 'mzqbj'
        };
        $http.post('/user/bind-wechat-oa',params, {isJwt: true}).then(function(res) {
          if(res.succeed){
            location.href = 'success.html';
          } else {
            vm.toastMsg = res.errorMessage;
          }
        });
      },

      bind: function() {
        if (!this.user.phone.length && !this.user.codeMsg.length) {
          this.toastMsg = '登录信息未完善';
          return;
        }
        if (!this.user.phone.length) {
          this.toastMsg = '请输入用户名';
          return;
        }
        var req = /1[345789]\d{9}$/;
        if (!req.test(this.user.phone)) {
          this.toastMsg = '请输入正确格式的手机号码';
          return;
        }
        if (!this.user.codeMsg.length) {
          this.toastMsg = '请输入验证码';
          return;
        }
        vm.doLogin();  
      },

      del:function(){
        vm.user.codeMsg = '' ;
      },
      
      goRegister:function(){
        location.href = 'register.html';
      },

      blur: function(){
        vm.focusStatus = 0;
      }

    }
  });
  vm.init();

  function handler(e) {
    vm.toastMsg = e.detail;
    vm.isLoading = false;
  }

  eventListener('loading', function() {
    vm.isLoading = true;
  });

  eventListener('loaded', function() {
    vm.isLoading = false;
  });

  eventListener('error', handler);

})();

