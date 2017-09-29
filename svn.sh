svn delete svn://192.168.1.40/MSI-FE/h5/maizi/weixin-bind -m "delete auto sh"
svn mkdir svn://192.168.1.40/MSI-FE/h5/maizi/weixin-bind -m "create auto sh"
svn import ./dist/ svn://192.168.1.40/MSI-FE/h5/maizi/weixin-bind -m "upload auto sh"