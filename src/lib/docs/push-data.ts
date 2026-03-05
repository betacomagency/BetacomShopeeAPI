export interface PushParam {
  name: string
  type: string
  sample?: string
  required?: boolean
  description: string
  children?: PushParam[]
}

export interface PushContent {
  title: string
  json: string
}

export interface UpdateLogEntry {
  date: string
  details: string
}

export interface PushMechanism {
  id: string
  module: string
  category: string
  name: string
  code: number
  description: string
  subscriptionRules: string
  timeoutSeconds: string
  sequenceGuaranteed: boolean
  canRepeatedSameMessage: boolean
  retrySeconds: string
  lastUpdated: string
  pushParams: PushParam[]
  pushContents: PushContent[]
  updateLog: UpdateLogEntry[]
}

export const pushMechanisms: PushMechanism[] = [
  {
    id: "shop-authorization-push",
    module: "public",
    category: "Shopee Push",
    name: "shop_authorization_push",
    code: 1,
    description:
      "Push này cho phép bạn nhận thông báo khi shop hoặc merchant được uỷ quyền cho ứng dụng của bạn.",
    subscriptionRules:
      "Original/ERP System/Seller In House System/Product Management/Order Management/Accounting And Finance/Marketing/Customer Service/Customized APP/Ads Service/Consignment Service System/Seller Logistics/Custom APP/Swam ERP/Livestream Management/Ads Facil/Affiliate Marketing Solution Management/Shopee Video Management",
    timeoutSeconds: "3s",
    sequenceGuaranteed: false,
    canRepeatedSameMessage: true,
    retrySeconds: "300s,1800s,10800s",
    lastUpdated: "2 Sep 2022",
    pushParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "200000",
        description:
          "ID định danh duy nhất của Shopee cho ứng dụng của bạn. Partner ID được cấp khi đăng ký thành công.",
      },
      {
        name: "code",
        type: "int",
        sample: "1",
        description: "Mã định danh duy nhất của Shopee cho push notification.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi tin nhắn (Unix timestamp).",
      },
      {
        name: "data",
        type: "object[]",
        description: "",
        children: [
          {
            name: "shop_id",
            type: "int",
            sample: "600000",
            required: false,
            description:
              "ID định danh duy nhất của shop trên Shopee. Cho biết shop nào đã được uỷ quyền.",
          },
          {
            name: "shop_id_list",
            type: "int[]",
            sample: "[6000000,60000001]",
            required: false,
            description:
              "Nếu người bán dùng tài khoản chính để uỷ quyền nhiều shop cùng lúc, tham số này sẽ liệt kê tất cả các shop được uỷ quyền.",
          },
          {
            name: "merchant_id",
            type: "int",
            sample: "600000",
            required: false,
            description:
              "ID định danh duy nhất của merchant trên Shopee. Cho biết merchant nào đã được uỷ quyền.",
          },
          {
            name: "merchant_id_list",
            type: "int[]",
            sample: "[6000000,60000001]",
            required: false,
            description:
              "Nếu người bán dùng tài khoản chính để uỷ quyền nhiều merchant cùng lúc, tham số này sẽ liệt kê tất cả các merchant được uỷ quyền.",
          },
          {
            name: "authorize_type",
            type: "string",
            sample: "shop authorization by user",
            description: "Phương thức uỷ quyền shop cho ứng dụng.",
          },
          {
            name: "extra",
            type: "string",
            sample: "shop id 600000 (SG) has been authorized",
            description: "Chi tiết của lần uỷ quyền.",
          },
          {
            name: "main_account_id",
            type: "int",
            sample: "60000",
            required: false,
            description:
              "ID định danh duy nhất của tài khoản chính trên Shopee. Nếu người bán dùng tài khoản chính để uỷ quyền, tham số này cho biết tài khoản chính nào đã được sử dụng.",
          },
          {
            name: "success",
            type: "int",
            sample: "1",
            description: "Cho biết push có thành công hay không.",
          },
        ],
      },
    ],
    pushContents: [
      {
        title: "Người bán uỷ quyền shop",
        json: '{"data":{"authorize_type":"shop authorization by user","extra":"shop id 600000 (SG) has been authorized successfully","shop_id":60011111,"success":1},"partner_id":2000002,"code":1,"timestamp":1660616278}',
      },
      {
        title: "Người bán dùng tài khoản chính để uỷ quyền nhiều shop",
        json: '{"data":{"authorize_type":"shop authorization by user","extra":"Shop has been authorized successfully","main_account_id":68272,"shop_id_list":[62000001,62000002,62000003,62000004],"success":1},"partner_id":2000002,"code":1,"timestamp":1660616631}',
      },
      {
        title: "Người bán dùng tài khoản chính để uỷ quyền merchant",
        json: '{"data":{"authorize_type":"merchant authorization by user","extra":"merchant id 600000 has been authorized successfully","merchant_id":600222872,"success":1},"partner_id":2000007,"code":1,"timestamp":1660616278}',
      },
    ],
    updateLog: [
      { date: "2022-08-18", details: "Push Mechanism mới" },
    ],
  },
  {
    id: "shop-authorization-canceled-push",
    module: "public",
    category: "Shopee Push",
    name: "shop_authorization_canceled_push",
    code: 2,
    description:
      "Push này cho phép bạn nhận thông báo khi shop, merchant hoặc người dùng bị huỷ uỷ quyền khỏi ứng dụng của bạn.",
    subscriptionRules:
      "Original/ERP System/Seller In House System/Product Management/Order Management/Accounting And Finance/Marketing/Customer Service/Customized APP/Ads Service/Consignment Service System/Seller Logistics/Custom APP/Swam ERP/Livestream Management/Ads Facil/Affiliate Marketing Solution Management/Shopee Video Management",
    timeoutSeconds: "3s",
    sequenceGuaranteed: false,
    canRepeatedSameMessage: true,
    retrySeconds: "300s,1800s,10800s",
    lastUpdated: "29 Dec 2025",
    pushParams: [
      {
        name: "partner_id",
        type: "int64",
        sample: "200000",
        description:
          "ID định danh duy nhất của Shopee cho ứng dụng của bạn. Partner ID được cấp khi đăng ký thành công.",
      },
      {
        name: "code",
        type: "int32",
        sample: "2",
        description: "Mã định danh duy nhất của Shopee cho push notification.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi tin nhắn (Unix timestamp).",
      },
      {
        name: "data",
        type: "object[]",
        description: "",
        children: [
          {
            name: "shop_id",
            type: "int64",
            sample: "600000",
            required: false,
            description:
              "ID định danh duy nhất của shop trên Shopee. Cho biết shop nào đã bị huỷ uỷ quyền.",
          },
          {
            name: "shop_id_list",
            type: "int64[]",
            sample: "[6000000,60000001]",
            required: false,
            description:
              "ID định danh duy nhất của shop trên Shopee. Cho biết những shop nào đã bị huỷ uỷ quyền.",
          },
          {
            name: "merchant_id",
            type: "int64",
            sample: "600000",
            required: false,
            description:
              "ID định danh duy nhất của merchant trên Shopee. Cho biết merchant nào đã bị huỷ uỷ quyền.",
          },
          {
            name: "merchant_id_list",
            type: "int64[]",
            sample: "[6000000,60000001]",
            required: false,
            description:
              "ID định danh duy nhất của merchant trên Shopee. Cho biết những merchant nào đã bị huỷ uỷ quyền.",
          },
          {
            name: "user_id",
            type: "int64",
            sample: "368765104",
            required: false,
            description:
              "ID định danh duy nhất của người dùng trên Shopee. Cho biết người dùng nào đã bị huỷ uỷ quyền.",
          },
          {
            name: "user_id_list",
            type: "int64[]",
            sample: "[368765100,368765098,368765097]",
            required: false,
            description:
              "ID định danh duy nhất của người dùng trên Shopee. Cho biết những người dùng nào đã bị huỷ uỷ quyền.",
          },
          {
            name: "authorize_type",
            type: "string",
            sample: "shop authorization by user",
            description: "Phương thức huỷ uỷ quyền.",
          },
          {
            name: "extra",
            type: "string",
            sample: "shop id 600000 (SG) has been deauthorized",
            description: "Chi tiết của lần huỷ uỷ quyền.",
          },
          {
            name: "main_account_id",
            type: "int64",
            sample: "60000",
            required: false,
            description:
              "ID định danh duy nhất của tài khoản chính trên Shopee. Nếu người bán dùng tài khoản chính để huỷ uỷ quyền, tham số này cho biết tài khoản chính nào đã được sử dụng.",
          },
          {
            name: "success",
            type: "int32",
            sample: "1",
            description: "Cho biết push có thành công hay không.",
          },
        ],
      },
    ],
    pushContents: [
      {
        title: "Người bán huỷ uỷ quyền shop",
        json: '{"data":{"authorize_type":"user cancel shop authorization","success":1,"extra":"shop id 22000000 (VN) has been cancelled its authorization"},"code":2,"partner_id":800000,"timestamp":1653394175}',
      },
      {
        title: "Người bán dùng tài khoản chính để huỷ uỷ quyền",
        json: '{"data":{"authorize_type":"user cancel merchant authorization","merchant_id_list":[1001000],"main_account_id":19000,"success":1,"extra":"merchant shop cancelled its authorization"},"code":2,"partner_id":800000,"timestamp":1653026849}',
      },
      {
        title: "Uỷ quyền hết hạn",
        json: '{"data":{"authorize_type":"expiry","shopid":22000000,"success":1,"extra":"The authorization is expired."},"code":2,"partner_id":800000,"timestamp":1653026985}',
      },
      {
        title: "Huỷ uỷ quyền do trạng thái shop bất thường",
        json: '{"data":{"authorize_type":"App status is abnormal","shopid":22000000,"success":1,"extra":"Shop ID 22000000 is currently frozen. The authorization cannot be completed."},"code":2,"partner_id":800000,"timestamp":1653026985}',
      },
      {
        title: "Huỷ uỷ quyền do shop và tài khoản chính bị ngắt kết nối",
        json: '{"data":{"authorize_type":"shop and main account is disconnected","shopid":22000000,"success":1,"extra":"Shop (ID: 22000000) is disconnected from the main seller account (ID:30000). The authorization cannot be completed."},"code":2,"partner_id":800000,"timestamp":1653026985}',
      },
    ],
    updateLog: [],
  },
  {
    id: "open-api-authorization-expiry-push",
    module: "public",
    category: "Shopee Push",
    name: "open_api_authorization_expiry",
    code: 12,
    description:
      "Push thông báo các shop, merchant và người dùng có uỷ quyền sắp hết hạn trong vòng một tuần.",
    subscriptionRules:
      "ERP System/Seller In House System/Product Management/Order Management/Accounting And Finance/Marketing/Customer Service/Customized APP/Ads Service/Consignment Service System/Seller Logistics/Custom APP/Swam ERP/Livestream Management/Ads Facil/Affiliate Marketing Solution Management/Shopee Video Management",
    timeoutSeconds: "3s",
    sequenceGuaranteed: false,
    canRepeatedSameMessage: true,
    retrySeconds: "300s,1800s,10800s",
    lastUpdated: "29 Dec 2025",
    pushParams: [
      {
        name: "code",
        type: "int32",
        sample: "12",
        description: "Mã định danh duy nhất của Shopee cho push notification.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1568606634",
        description: "Thời gian gửi tin nhắn (Unix timestamp).",
      },
      {
        name: "data",
        type: "object[]",
        description: "",
        children: [
          {
            name: "merchant_expire_soon",
            type: "int64[]",
            sample: "[123123,123123,4342,3242342]",
            description:
              "Danh sách merchant ID có uỷ quyền sắp hết hạn trong vòng một tuần.",
          },
          {
            name: "shop_expire_soon",
            type: "int64[]",
            sample: "[23213,243242,342343,42342345656,45345]",
            description:
              "Danh sách shop ID có uỷ quyền sắp hết hạn trong vòng một tuần.",
          },
          {
            name: "user_expire_soon",
            type: "int64[]",
            sample: "[368765104,368765105,368765106]",
            description:
              "Danh sách user ID có uỷ quyền sắp hết hạn trong vòng một tuần.",
          },
          {
            name: "expire_before",
            type: "timestamp",
            sample: "1619740800",
            description:
              "Thời gian hết hạn của các merchant và shop được push là trước mốc thời gian này.",
          },
          {
            name: "page_no",
            type: "int32",
            sample: "1",
            description: "",
          },
          {
            name: "total_page",
            type: "int32",
            sample: "2",
            description: "",
          },
        ],
      },
    ],
    pushContents: [
      {
        title: "Thông báo uỷ quyền sắp hết hạn",
        json: '{"code":12,"timestamp":1568606634,"data":{"merchant_expire_soon":[123123,123123,4342,3242342],"shop_expire_soon":[23213,243242,342343,42342345656,45345],"user_expire_soon":[368765104,368765105,368765106],"expire_before":1619740800,"page_no":1,"total_page":2}}',
      },
    ],
    updateLog: [],
  },
  {
    id: "shop-penalty-update-push",
    module: "shop",
    category: "Shopee Push",
    name: "shop_penalty_update_push",
    code: 28,
    description:
      "Nhận thông báo khi điểm phạt hoặc mức xử phạt của shop được cập nhật.",
    subscriptionRules:
      "Seller In House System/Product Management/Order Management/ERP System/Swam ERP/Livestream Management/Affiliate Marketing Solution Management/Shopee Video Management",
    timeoutSeconds: "3s",
    sequenceGuaranteed: false,
    canRepeatedSameMessage: true,
    retrySeconds: "300s,1800s,10800s",
    lastUpdated: "5 Nov 2024",
    pushParams: [
      {
        name: "data",
        type: "object",
        description: "Thông tin chính của push.",
        children: [
          {
            name: "action_type",
            type: "int32",
            description:
              "Loại sự kiện:\n1: Cộng điểm phạt\n2: Gỡ điểm phạt\n3: Cập nhật mức xử phạt",
          },
          {
            name: "points_issued_data",
            type: "object",
            description: "",
            children: [
              {
                name: "issued_points",
                type: "int32",
                sample: "3",
                description: "Số điểm phạt được cộng.",
              },
              {
                name: "violation_type",
                type: "int32",
                sample: "10",
                description:
                  "Loại vi phạm:\n5: Tỷ lệ giao trễ cao\n6: Tỷ lệ không hoàn thành đơn cao\n7: Số đơn không hoàn thành cao\n8: Số đơn giao trễ cao\n9: Sản phẩm bị cấm\n10: Hàng giả/Vi phạm sở hữu trí tuệ\n11: Spam\n12: Sao chép/Ăn cắp hình ảnh",
              },
            ],
          },
          {
            name: "points_removed_data",
            type: "object",
            description: "",
            children: [
              {
                name: "removed_points",
                type: "int32",
                sample: "3",
                description: "Số điểm phạt được gỡ.",
              },
              {
                name: "violation_type",
                type: "int32",
                sample: "10",
                description:
                  "Loại vi phạm (tương tự như points_issued_data).",
              },
              {
                name: "removed_reason",
                type: "int32",
                sample: "102",
                description:
                  "Lý do gỡ điểm phạt:\n101: Lý do khác\n102: Lỗi hệ thống Shopee\n103: Sự cố đơn vị vận chuyển\n104: Thời tiết/Thiên tai\n105: Miễn trừ đặc biệt\n106: Miễn trừ cho SBS fulfillment\n107: Miễn trừ cho SIP listing violation\n108: IPR đã xác minh",
              },
            ],
          },
          {
            name: "tier_update_data",
            type: "object",
            description: "",
            children: [
              {
                name: "old_tier",
                type: "int32",
                sample: "3",
                description: "Mức xử phạt trước khi cập nhật.",
              },
              {
                name: "new_tier",
                type: "int32",
                sample: "4",
                description: "Mức xử phạt sau khi cập nhật.",
              },
            ],
          },
        ],
      },
      {
        name: "update_time",
        type: "timestamp",
        sample: "1660124246",
        description: "Thời gian cập nhật điểm phạt hoặc mức xử phạt.",
      },
      {
        name: "shop_id",
        type: "int64",
        sample: "127449165",
        description: "ID định danh duy nhất của shop trên Shopee.",
      },
      {
        name: "code",
        type: "int32",
        sample: "28",
        description: "Mã định danh duy nhất của Shopee cho push notification.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1660124246",
        description: "Thời gian gửi tin nhắn (Unix timestamp).",
      },
    ],
    pushContents: [
      {
        title: "Cập nhật điểm phạt shop",
        json: '{"data":{"action_type":1,"points_issued_data":{"issued_points":3,"violation_type":10},"update_time":1660124246},"shop_id":127449165,"code":28,"timestamp":1660124246}',
      },
    ],
    updateLog: [],
  },
]
