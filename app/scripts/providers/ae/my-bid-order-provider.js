/**
 * The MIT License (MIT)
 * Copyright (c) 2016 Krypto Fin ry and the FIMK Developers
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * */
(function () {
'use strict';
var module = angular.module('fim.base');
module.factory('MyBidOrderProvider', function (nxt, $q, IndexedEntityProvider) {

  function MyBidOrderProvider(api, $scope, pageSize, asset, decimals, account) {
    this.init(api, $scope, pageSize);
    this.asset = asset;
    this.decimals = decimals;
    this.account = account;

    api.engine.socket().subscribe('blockPopped', angular.bind(this, this.blockPopped), $scope);
    api.engine.socket().subscribe('blockPushed', angular.bind(this, this.blockPushed), $scope);

    api.engine.socket().subscribe('BID_ORDER_ADD*'+asset, angular.bind(this, this.orderAddUpdate), $scope);
    api.engine.socket().subscribe('BID_ORDER_UPDATE*'+asset, angular.bind(this, this.orderAddUpdate), $scope);
    api.engine.socket().subscribe('BID_ORDER_REMOVE*'+asset, angular.bind(this, this.orderRemove), $scope);
  }
  angular.extend(MyBidOrderProvider.prototype, IndexedEntityProvider.prototype, {

    /* @override */
    sortFunction: function (a, b) {
      if (a.priceNum > b.priceNum) return -1;
      else if (a.priceNum < b.priceNum) return 1;
      else {
        if (a.height < b.height) return -1;
        else if (a.height > b.height) return 1;
        else {
          if (a.order < b.order) return -1;
          else if (a.order > b.order) return 1;
        }
      }
      return 0;
    },

    /* @override */
    uniqueKey: function (order) { return order.order },

    getData: function (firstIndex) {
      var deferred = $q.defer();
      var args = {
        asset:          this.asset,
        account:        this.account,
        firstIndex:     firstIndex,
        lastIndex:      firstIndex + this.pageSize,
        requestType:    'getVirtualBidOrders'
      }
      this.api.engine.socket().callAPIFunction(args).then(deferred.resolve, deferred.reject);
      return deferred.promise;
    },

    translate: function (order) {
      if (order.quantityQNT) {
        order.quantity = nxt.util.convertToQNTf(order.quantityQNT, this.decimals);
      }
      if (order.priceNQT) {
        order.price = nxt.util.calculateOrderPricePerWholeQNT(order.priceNQT, this.decimals);
        order.total = nxt.util.convertToNXT(nxt.util.calculateOrderTotalNQT(order.priceNQT, order.quantityQNT));
        order.priceNum = parseFloat(order.price.replace(',',''));
      }
    },

    dataIterator: function (data) {
      var decimals = data.decimals, orders = data.bidOrders || [];
      for (var i=0; i<orders.length; i++) {
        this.translate(orders[i]);
      }
      return new Iterator(orders);
    },

    getTypeColor: function (type) {
      return type == 'buy' ? 'green' : 'red';
    },

    /* @websocket */
    blockPopped: function (block) {
      if (this.delayedReload) {
        clearTimeout(this.delayedReload);
      }
      var self = this;
      this.delayedReload = setTimeout(function () { self.reload(); }, 1000);
    },

    /* @websocket */
    blockPushed: function (block) {
      var self = this;
      this.$scope.$evalAsync(function () {
        self.forEach(function (order) {
          order.confirmations = block.height - order.height;
        });
      });
    },

    /* @websocket */
    orderAddUpdate: function (order) {
      if (order.accountRS && order.accountRS != this.account) return;
      //if (!this.keys[order.order]) return;
      var self = this;
      this.$scope.$evalAsync(function () {
        self.translate(order);
        self.add(order);
      });
    },

    /* @websocket */
    orderRemove: function (order) {
      var self = this;
      this.$scope.$evalAsync(function () {
        self.remove(self.uniqueKey(order));
      });
    }
  });
  return MyBidOrderProvider;
});
})();