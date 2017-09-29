(function() {
  var HOST = /nonobank.com|mingxiaodai.com/.test(location.host) ? (location.protocol + '//' + location.host + (location.port ? ':' + location.port : '')) : "https://m.sit.nonobank.com";

  var am_id = getSearch()['am_id'] || '',
    approach = getSearch()['approach'] || '',
    approach2 = getSearch()['approach2'] || '',
    approach3 = getSearch()['approach3'] || '';
  var $http, uuid,
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
        codeImg: '',
        codeMsg: '',
        agreement: true,
        autobuild: true
      },
      btnActive: false,
      imgSrc: '',
      imgMask: false,
      btnDisabled: false,
      nonoActive: false,
      caishenActive: false,
      timeCount: -1,
      focusStatus: 0, //1、图形验证码聚焦  2、短信验证码聚焦 3、手机号聚焦
      isLoading: false,
      toastMsg: ''
    },
    watch: {
      'user.phone': function(val, oldval) {
        vm.focusStatus = 0;
        errortype = 0;
        if (val.length == 11) {
          vm.checkPhone();
          if (errortype == 0) {
            $http.get('/common/check/mobile/' + val).then(function(res) {
              if (res.succeed) {
                if (res.data.exists) {
                  vm.toastMsg = '手机号已注册';
                  errortype = 3;
                } else {
                  errortype = 0;
                  vm.focusStatus = 1;
                }
              } else {
                vm.toastMsg = res.errorMessage;
              }
            });
          }
        }
        if (codeSentTime >= 1) {
          codeSentTime = 0;
          vm.focusStatus = 0;
          vm.user.codeImg = '';
          vm.user.codeMsg = '';
          vm.timeCount = -1;
          setTimeout(function() {
            clearTimeout(timer);
            vm.refreshCaptcha();
          }, 0);
        }
      }
    },
    methods: {
      init: function() {
        $http = new http();
        vm.imgMask = false;
        this.getTime(vm.refreshCaptcha());
      },

      getTime: function(callback) {
        $http.get('/common/current', { isTime: true }).then(function(res) {
          if (res && res.succeed) {
            vm.setTime(res.data.timestamp);
            callback;
          }
        });
      },

      setTime: function(timeSys) {
        var offsetTime = timeSys - Date.now();
        setSession('landing-offsetTime', offsetTime);
      },

      refreshCaptcha: function() {
        $http.get('/common/captcha').then(function(res) {
          if (res && res.succeed) {
            var data = res.data;
            vm.imgSrc = data.captcha;
            uuid = data.uuid;
          }
        });
      },

      checkPhone: function() {
        var req = /1[345789]\d{9}$/;

        if (!this.user.phone.length) {
          this.toastMsg = '请输入手机号码';
          errortype = 1;
          return;
        }
        if (!req.test(this.user.phone)) {
          this.toastMsg = '请输入正确格式的手机号码';
          errortype = 1;
          return;
        }
        if (errortype == 3) {
          this.toastMsg = '手机号已注册~';
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

      getCode: function(type) {
        if (type == 'showImgMask') {
          vm.imgMask = true;
          vm.user.codeImg = '';
          vm.refreshCaptcha();
          vm.btnActive = false;
          return;
        } 
        vm.imgMask = false;
        vm.btnActive = true;

        var bizCode = 0;
        if (vm.caishenActive) {
          bizCode = 4;
        }
       
        vm.focusStatus = 2;
        var params = {
          mobile: vm.user.phone,
          captcha: vm.user.codeImg,
          uuid: uuid,
          codeType: 0,
          tokenId: tokenId,
          bizCode: bizCode
        }
        $http.post('/user/v-code', params).then(function(res) {
          if (res.succeed) {
            vm.btnDisabled = true;
            codeSentTime += 1;
            vm.timeCount = 60;
            vm.countDown(vm.timeCount);
            setTimeout(function() {
              vm.focusStatus = 2;
            }, 1000);
          } else {
            vm.btnDisabled = false;
            vm.toastMsg = res.errorMessage;
            codeSentTime = 0;
            vm.focusStatus = 1;
            vm.user.codeImg = '';
            vm.user.codeMsg = '';
            vm.timeCount = -1;
            vm.imgMask = true;
            setTimeout(function() {
              clearTimeout(timer);
              vm.refreshCaptcha();
            }, 0);
          }
        });
      },

      doRegister: function() {
        var pcId = 1,
          bizCode = 0;
        if (vm.caishenActive) {
          pcId = 18;
          bizCode = 4;
        }
        var params = {
          mobile: vm.user.phone,
          vcode: vm.user.codeMsg,
          tokenId: tokenId,
          uuid: uuid,
          captcha: vm.user.codeImg,

          pcId: pcId,
          bizCode: bizCode,
          amId: am_id,
          approach: approach,
          approach2: approach2,
          approach3: approach3
        }
        $http.post('/user/register', params, { loading: true }).then(function(res) {
          if (res.succeed) {
            var jwt = res.data.jwt;
            sessionStorage.setItem('bind-jwt', jwt);
            vm.bindWechat();
          } else if (res.errorCode == '0100154') {
            vm.toastMsg = '短信验证码输入有误';
          } else {
            vm.toastMsg = res.errorMessage;
          }
        });
      },

      bindWechat:function(){
        var openId = sessionStorage.getItem('open-id');
        var params = {
          openId: openId,
          oa: 'mzqbj',
        };
        $http.post('/user/bind-wechat-oa',params, {isJwt: true}).then(function(res) {
          if(res.succeed){
            location.href = 'success.html';
          } else {
            vm.toastMsg = res.errorMessage;
          }
        });
      },

      sure: function() {
        if (vm.user.codeImg.length == 4) {
          var val = vm.user.codeImg;
          if (errortype == 0) {
            var params = {
              uuid: uuid,
              captcha: val
            };
            $http.get('/common/captcha/verify', { params: params }).then(function(res) {
              if (res.succeed && res.data.valid) {
                vm.getCode();
              } else {
                vm.toastMsg = '您输入的验证码错误';
                vm.imgMask = true;
                vm.focusStatus = 1;
                vm.user.codeImg = '';
                vm.refreshCaptcha();
              }
            });
          }
          return;
        }
        vm.toastMsg = '请输入图示4位字符';
      },

      register: function() {
        vm.checkPhone();

        if (errortype != 0) {
          return;
        }
        if (this.user.codeImg.length < 4 || this.user.codeMsg.length < 4) {
          vm.toastMsg = '请输入正确的验证码';
          return;
        }
        if (!this.nonoActive && !this.caishenActive) {
          vm.toastMsg = '请选择您要注册的理财业务';
          return;
        }
        if (!this.user.agreement || !this.user.autobuild) {
          vm.toastMsg = '请阅读并勾选相关协议';
          return;
        }
        vm.doRegister();

      },

      blur: function() {
        vm.focusStatus = 0;
      },

      getImgMask: function() {
        vm.checkPhone();
        if (errortype != 0) {
          return;
        }
        if (!this.nonoActive && !this.caishenActive) {
          vm.toastMsg = '请选择您要注册的理财业务';
          return;
        }
        vm.imgMask = true;
        vm.refreshCaptcha();
      },

      closeImgMask: function() {
        vm.imgMask = false;
      },

      del: function() {
        vm.user.codeMsg = '';
      },

      nonoSelect: function() {
        vm.nonoActive = true;
        vm.caishenActive = false;
      },

      caishenSelect: function() {
        vm.caishenActive = true;
        vm.nonoActive = false;
      },

      goRegPrivacy:function(){
        location.href = 'regprivacy.html';
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
