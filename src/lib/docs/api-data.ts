export interface ApiParam {
  name: string
  type: string
  required?: boolean
  sample?: string
  description: string
}

export interface ApiEnvironment {
  name: string
  url: string
}

export interface ApiEndpoint {
  id: string
  module: string
  name: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  description: string
  environments: ApiEnvironment[]
  commonParams: ApiParam[]
  requestParams: ApiParam[]
  responseParams: ApiParam[]
}

export const apiModules = [
  { id: "public", name: "Xác thực", description: "Xác thực & Token" },
  { id: "shop", name: "Shop", description: "Quản lý Shop" },
  { id: "account_health", name: "Account Health", description: "Hiệu suất & Vi phạm" },
  { id: "product", name: "Sản phẩm", description: "Quản lý Sản phẩm" },
  { id: "order", name: "Đơn hàng", description: "Quản lý Đơn hàng" },
  { id: "logistics", name: "Vận chuyển", description: "Vận chuyển" },
  { id: "payment", name: "Thanh toán", description: "Thanh toán" },
  { id: "flash_sale", name: "Flash Sale", description: "Quản lý Flash Sale" },
  { id: "push", name: "Push", description: "Cơ chế Push" },
  { id: "voucher", name: "Voucher", description: "Voucher" },
  { id: "ads", name: "Quảng cáo", description: "Quản lý Quảng cáo" },
]

export const apiEndpoints: ApiEndpoint[] = [
  {
    id: "get-all-cpc-ads-hourly-performance",
    module: "ads",
    name: "v2.ads.get_all_cpc_ads_hourly_performance",
    method: "GET",
    path: "/api/v2/ads/get_all_cpc_ads_hourly_performance",
    description: "Sử dụng API này để lấy hiệu suất đo lường theo từng giờ trong một ngày cho quảng cáo CPC (Cost-Per-Click) cấp độ Shop.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/ads/get_all_cpc_ads_hourly_performance",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/ads/get_all_cpc_ads_hourly_performance",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "performance_date",
        type: "string",
        required: true,
        sample: "17-03-2021",
        description: "Đây là thông số ngày duy nhất mà người yêu cầu muốn kiểm tra hiệu suất hàng giờ. Ngày có định dạng DD-MM-YYYY.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Mã lỗi. Sẽ rỗng nếu không có lỗi trả về.",
      },
      {
        name: "message",
        type: "string",
        description: "Mô tả lỗi.",
      },
      {
        name: "warning",
        type: "string",
        description: "Nếu một số dữ liệu không thể phản hồi bình thường, thiết lập cảnh báo này.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "6f235f4a343e4feb8a9ed74c439f6663",
        description: "Mã request id duy nhất cho mỗi yêu cầu.",
      },
      {
        name: "response",
        type: "object[]",
        description: "Mảng chứa dữ liệu phản hồi.",
      },
      {
        name: "response[].hour",
        type: "int32",
        sample: "13",
        description: "Thông số để cho biết giờ mỗi bản ghi hiệu suất thuộc về.",
      },
      {
        name: "response[].date",
        type: "string",
        sample: "17-03-2021",
        description: "Thông số để cho biết ngày bản ghi hiệu suất thuộc về.",
      },
      {
        name: "response[].impression",
        type: "int32",
        sample: "123156",
        description: "Số lần người mua xem quảng cáo.",
      },
      {
        name: "response[].clicks",
        type: "int32",
        sample: "123156",
        description: "Tổng số lần nhấp vào Quảng cáo.",
      },
      {
        name: "response[].ctr",
        type: "float",
        sample: "1.23",
        description: "Tỷ lệ nhấp qua (Click-through rate) đo lường tần suất người mua hàng xem quảng cáo kết thúc bằng việc nhấp vào quảng cáo. CTR = Clicks / Impressions.",
      },
      {
        name: "response[].direct_order",
        type: "int32",
        sample: "123156",
        description: "Người mua đặt hàng trong vòng 7 ngày sau khi nhấp vào quảng cáo (đặt mua chính mặt hàng từ quảng cáo đã nhấp). Ghi chú: direct_order phản ánh trong Shopee Ads Module ở Seller Center là mục 'Direct Conversions'.",
      },
      {
        name: "response[].broad_order",
        type: "int32",
        sample: "123156",
        description: "Người mua đặt hàng trong vòng 7 ngày sau khi nhấp vào quảng cáo (mặt hàng được mua miễn là có mặt hàng khác từ cùng shop vừa nhấp chuột). Ghi chú: broad_order phản ánh trong Shopee Ads Module ở Seller Center là 'Conversions'.",
      },
      {
        name: "response[].direct_conversions",
        type: "float",
        sample: "1.23",
        description: "Số đơn hàng trực tiếp / Tổng số lượt click vào Quảng cáo. (Mặt hàng được mua từ quảng cáo đã nhấp). Phản ánh trong Seller Center là 'Direct Conversion Rate'.",
      },
      {
        name: "response[].broad_conversions",
        type: "float",
        sample: "1.23",
        description: "Số đơn hàng Ads / Tổng số lượt nhấp chuột vào Quảng cáo. (Gồm cả hàng khác cùng shop). Ghi chú: Phản ánh trong Seller Center là 'Conversion Rate'.",
      },
      {
        name: "response[].direct_item_sold",
        type: "int32",
        sample: "123",
        description: "Số lượng mặt hàng được bán trong vòng 7 ngày sau khi nhấp chuột (Mặt hàng mua từ quảng cáo đang nhấp).",
      },
      {
        name: "response[].broad_item_sold",
        type: "int32",
        sample: "123",
        description: "Số lượng mặt hàng được bán trong vòng 7 ngày sau khi nhấp chuột (Miễn là từ cùng một cửa hàng).",
      },
      {
        name: "response[].direct_gmv",
        type: "float",
        sample: "1.23",
        description: "Tổng doanh thu tạo ra từ Quảng cáo trực tiếp (Mặt hàng từ quảng cáo trên) trong thường là 7 ngày.",
      },
      {
        name: "response[].broad_gmv",
        type: "float",
        sample: "1.23",
        description: "Tổng doanh thu tạo ra từ Quảng cáo (Cả mua hàng từ cùng một shop) trong 7 ngày.",
      },
      {
        name: "response[].expense",
        type: "float",
        sample: "1.23",
        description: "Tổng cước phí/Chi phí đã chi tiêu cho Quảng cáo.",
      },
      {
        name: "response[].cost_per_conversion",
        type: "float",
        sample: "1.23",
        description: "(Chi phí mỗi lượt chuyển đổi) Chi phí trung bình của Quảng cáo trên mỗi chuyển đổi bán hàng.",
      },
      {
        name: "response[].direct_roas",
        type: "float",
        sample: "1.23",
        description: "Quảng cáo Trực tiếp GMV/Chi phí quảng cáo.",
      },
      {
        name: "response[].broad_roas",
        type: "float",
        sample: "1.23",
        description: "Quảng cáo Mở rộng GMV/Chi phí quảng cáo (bao gồm các sản phẩm khác thuộc cửa hàng).",
      },
    ],
  },
  {
    id: "get-recommended-item-list",
    module: "ads",
    name: "v2.ads.get_recommended_item_list",
    method: "GET",
    path: "/api/v2/ads/get_recommended_item_list",
    description: "Sử dụng API này để lấy danh sách các SKU được đề xuất (cấp cửa hàng) với thẻ hiển thị như tìm kiếm hàng đầu/bán chạy nhất/ROI tốt nhất (top search/best selling/best ROI tag).",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/ads/get_recommended_item_list",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/ads/get_recommended_item_list",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Mã lỗi. Rỗng khi không có lỗi trả về.",
      },
      {
        name: "message",
        type: "string",
        description: "Mô tả lỗi.",
      },
      {
        name: "warning",
        type: "string",
        description: "Nếu một số dữ liệu không thể phản hồi bình thường, hệ thống sẽ thiết lập cảnh báo này.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "6f235f4a343e4feb8a9ed74c439f6663",
        description: "Mã request id là duy nhất cho mỗi yêu cầu.",
      },
      {
        name: "response",
        type: "object[]",
        description: "Nội dung mảng đối tượng phản hồi.",
      },
      {
        name: "response[].item_id",
        type: "int32",
        sample: "1234",
        description: "ID của mặt hàng SKU được đề xuất.",
      },
      {
        name: "response[].item_status_list",
        type: "string[]",
        sample: "[\"blocked\"]",
        description: "Thông số để cho biết trạng thái của các mặt hàng, nhờ đó người bán có thể biết mặt hàng có đủ điều kiện để chạy quảng cáo hay không.",
      },
      {
        name: "response[].sku_tag_list",
        type: "string[]",
        sample: "[\"best selling\"]",
        description: "Các thẻ tương ứng thuộc về item_id. Chuỗi thứ tự tuân theo best selling > best ROI > top search.",
      },
      {
        name: "response[].ongoing_ad_type_list",
        type: "string[]",
        sample: "[\"search ads\", \"discovery ads\"]",
        description: "Trạng thái hiện tại của quảng cáo trên mặt hàng này. Ví dụ: no ongoing promotion (không có khuyến mại nào đang diễn ra), search ads, discovery ads, boost ads.",
      },
    ],
  },
  {
    id: "get-recommended-keyword-list",
    module: "ads",
    name: "v2.ads.get_recommended_keyword_list",
    method: "GET",
    path: "/api/v2/ads/get_recommended_keyword_list",
    description: "Sử dụng API này để nhận danh sách các từ khoá được đề xuất cho từng sản phẩm và (tuỳ chọn) theo cả từ khoá tìm kiếm.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/ads/get_recommended_keyword_list",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/ads/get_recommended_keyword_list",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "item_id",
        type: "int32",
        required: true,
        sample: "1111",
        description: "Mã định danh duy nhất của Shopee cho một mặt hàng (sản phẩm).",
      },
      {
        name: "input_keyword",
        type: "string",
        required: false,
        sample: "keyword",
        description: "Từ khoá mà người bán gõ vào trong cửa sổ thêm từ khoá thủ công.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Mã lỗi, rỗng khi không có lỗi trả về.",
      },
      {
        name: "message",
        type: "string",
        description: "Mô tả lỗi.",
      },
      {
        name: "warning",
        type: "string",
        description: "Nếu một số dữ liệu không thể phản hồi bình thường, hệ thống sẽ thiết lập cảnh báo (warning).",
      },
      {
        name: "request_id",
        type: "string",
        sample: "6f235f4a343e4feb8a9ed74c439f6663",
        description: "Mã request id là duy nhất cho mỗi yêu cầu.",
      },
      {
        name: "response",
        type: "object",
        description: "Nội dung phản hồi.",
      },
      {
        name: "response.item_id",
        type: "int32",
        sample: "1111",
        description: "Mã định danh duy nhất của Shopee cho một mặt hàng.",
      },
      {
        name: "response.input_keyword",
        type: "string",
        sample: "keyword",
        description: "Từ khoá mà người bán đã gõ để tìm kiếm thủ công.",
      },
      {
        name: "response.suggested_keywords",
        type: "object[]",
        description: "Danh sách các từ khoá được đề xuất dựa trên sản phẩm.",
      },
      {
        name: "response.suggested_keywords[].keyword",
        type: "string",
        sample: "keyword",
        description: "Giá trị của từ khoá (Chỉ trả về các từ khoá được đề xuất cao, sẽ hơi khác so với Seller Center).",
      },
      {
        name: "response.suggested_keywords[].quality_score",
        type: "int32",
        sample: "8",
        description: "Đây là thước đo mức độ hấp dẫn của quảng cáo của bạn và mức độ liên quan của nó với từ khoá. Điểm chất lượng càng cao, thứ hạng quảng cáo càng cao. Thứ hạng quảng cáo dựa trên điểm số này và giá thầu của bạn.",
      },
      {
        name: "response.suggested_keywords[].search_volume",
        type: "int32",
        sample: "1234",
        description: "Số lần từ khoá được tìm kiếm trên Shopee trong 30 ngày qua. Khối lượng tìm kiếm càng lớn, quảng cáo của bạn sẽ nhận được càng nhiều lượt hiển thị.",
      },
      {
        name: "response.suggested_keywords[].suggested_bid",
        type: "float",
        sample: "12.34",
        description: "Giá thầu dự kiến được đề xuất bởi thuật toán Shopee cho từ khoá này theo đơn vị tiền tệ địa phương.",
      },
    ],
  },
  {
    id: "get-shop-toggle-info",
    module: "ads",
    name: "v2.ads.get_shop_toggle_info",
    method: "GET",
    path: "/api/v2/ads/get_shop_toggle_info",
    description: "Sử dụng API này để lấy thông tin cấp cửa hàng - ví dụ: trạng thái công tắc (toggle) của người bán đang bật hoặc tắt.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/ads/get_shop_toggle_info",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/ads/get_shop_toggle_info",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Mã lỗi, rỗng khi không có lỗi trả về.",
      },
      {
        name: "message",
        type: "string",
        description: "Mô tả lỗi.",
      },
      {
        name: "warning",
        type: "string",
        description: "Nếu một số dữ liệu không thể phản hồi bình thường, hệ thống sẽ thiết lập cảnh báo (warning).",
      },
      {
        name: "request_id",
        type: "string",
        sample: "6f235f4a343e4feb8a9ed74c439f6663",
        description: "Mã request id là duy nhất cho mỗi yêu cầu.",
      },
      {
        name: "response",
        type: "object",
        description: "Nội dung phản hồi.",
      },
      {
        name: "response.data_timestamp",
        type: "timestamp",
        sample: "1689052069",
        description: "Thời gian (Timestamp) của dữ liệu trong phản hồi.",
      },
      {
        name: "response.auto_top_up",
        type: "boolean",
        sample: "true",
        description: "Công tắc tự động nạp tiền (auto_top_up) đang bật hay tắt.",
      },
      {
        name: "response.campaign_surge",
        type: "boolean",
        sample: "false",
        description: "Công tắc chiến dịch tăng đột biến (campaign_surge) đang bật hay tắt.",
      },
    ],
  },
  {
    id: "get-total-balance",
    module: "ads",
    name: "v2.ads.get_total_balance",
    method: "GET",
    path: "/api/v2/ads/get_total_balance",
    description: "Sử dụng API này để trả về tổng số dư tín dụng quảng cáo theo thời gian thực của người bán, bao gồm tín dụng trả phí và tín dụng miễn phí.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/ads/get_total_balance",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/ads/get_total_balance",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Mã lỗi. Sẽ rỗng nếu không có lỗi trả về.",
      },
      {
        name: "message",
        type: "string",
        description: "Mô tả lỗi.",
      },
      {
        name: "warning",
        type: "string",
        description: "Nếu một số dữ liệu không thể phản hồi bình thường, thiết lập cảnh báo này.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "6f235f4a343e4feb8a9ed74c439f6663",
        description: "Mã request id duy nhất cho mỗi yêu cầu.",
      },
      {
        name: "response",
        type: "object",
        description: "Nội dung phản hồi.",
      },
      {
        name: "response.data_timestamp",
        type: "timestamp",
        sample: "1689052069",
        description: "Thông số để chỉ ra thời gian của ảnh chụp (snapshot) tổng số dư.",
      },
      {
        name: "response.total_balance",
        type: "float",
        sample: "123.55",
        description: "Đây là số dư tín dụng quảng cáo của người bán, bao gồm tín dụng trả phí và tín dụng miễn phí.",
      },
    ],
  },
  {
    id: "add-voucher",
    module: "voucher",
    name: "v2.voucher.add_voucher",
    method: "POST",
    path: "/api/v2/voucher/add_voucher",
    description: "Thêm một voucher mới.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/voucher/add_voucher",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/voucher/add_voucher",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "voucher_name",
        type: "string",
        required: true,
        sample: "testamount",
        description: "Tên của voucher.",
      },
      {
        name: "voucher_code",
        type: "string",
        required: true,
        sample: "test",
        description: "Mã của voucher.",
      },
      {
        name: "start_time",
        type: "timestamp",
        required: true,
        sample: "1624719600",
        description: "Thời gian từ khi voucher có hiệu lực; người mua được phép thu thập và sử dụng.",
      },
      {
        name: "end_time",
        type: "timestamp",
        required: true,
        sample: "1624978800",
        description: "Thời gian cho đến khi voucher hết hiệu lực. Sau khoảng thời gian này, người mua không được thu thập hay sử dụng.",
      },
      {
        name: "voucher_type",
        type: "int32",
        required: true,
        sample: "1",
        description: "Loại voucher. Các giá trị có sẵn là: 1: shop voucher, 2: product voucher.",
      },
      {
        name: "reward_type",
        type: "int32",
        required: true,
        sample: "1",
        description: "Loại phần thưởng của voucher. Các giá trị có sẵn là: 1: fix_amount voucher, 2: discount_percentage voucher, 3: coin_cashback voucher.",
      },
      {
        name: "usage_quantity",
        type: "int32",
        required: true,
        sample: "20000",
        description: "Số lần chứng từ này có thể được sử dụng.",
      },
      {
        name: "min_basket_price",
        type: "float",
        required: true,
        sample: "12.01",
        description: "Mức chi tiêu tối thiểu bắt buộc để sử dụng voucher này.",
      },
      {
        name: "discount_amount",
        type: "float",
        required: false,
        sample: "1.55",
        description: "Số tiền giảm giá được thiết lập cho voucher này. Chỉ điền khi bạn đang tạo voucher fix amount.",
      },
      {
        name: "percentage",
        type: "int32",
        required: false,
        sample: "22",
        description: "Tỷ lệ phần trăm giảm giá được đặt cho voucher này. Chỉ điền khi bạn đang tạo voucher discount percentage hoặc coin cashback.",
      },
      {
        name: "max_price",
        type: "float",
        required: false,
        sample: "12.0",
        description: "Số tiền giảm giá/giá trị tối đa mà người dùng có thể nhận được bằng cách sử dụng voucher này. Chỉ điền vào khi bạn đang tạo voucher discount percentage hoặc coin cashback. Nếu không có giới hạn giới hạn, có thể thiết lập là 0.",
      },
      {
        name: "display_channel_list",
        type: "int32[]",
        required: false,
        sample: "[1]",
        description: "Kênh FE nơi voucher sẽ được hiển thị. Các giá trị khả dụng là: 1: display_all, 3: feed, 4: live streaming, [] (trống - bị ẩn).",
      },
      {
        name: "item_id_list",
        type: "int64[]",
        required: false,
        sample: "[1223223, 1223213]",
        description: "Danh sách sản phẩm áp dụng được voucher này. Chỉ điền khi bạn tạo product voucher.",
      },
      {
        name: "display_start_time",
        type: "int32",
        required: false,
        sample: "162078900",
        description: "Thời gian voucher được hiển thị trên trang cửa hàng để người mua có thể lấy. Nếu display_channel_list trống thì để display_start_time rỗng.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "4e5d881ac1bc11ebba0dacde48001122",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Thông tin chi tiết bạn đang truy vấn.",
      },
      {
        name: "response.voucher_id",
        type: "int64",
        sample: "123",
        description: "ID định danh duy nhất của voucher vừa được tạo.",
      },
    ],
  },
  {
    id: "delete-voucher",
    module: "voucher",
    name: "v2.voucher.delete_voucher",
    method: "POST",
    path: "/api/v2/voucher/delete_voucher",
    description: "Xoá vourcher.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/voucher/delete_voucher",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/voucher/delete_voucher",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "voucher_id",
        type: "int64",
        required: true,
        sample: "1104340665",
        description: "ID định danh duy nhất của voucher mà bạn muốn xoá.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "034f813abf5e11eb9c4eacde48001122",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Thông tin chi tiết bạn đang truy vấn.",
      },
      {
        name: "response.voucher_id",
        type: "int64",
        sample: "1104340665",
        description: "ID duy nhất của voucher đang được xoá.",
      },
    ],
  },
  {
    id: "end-voucher",
    module: "voucher",
    name: "v2.voucher.end_voucher",
    method: "POST",
    path: "/api/v2/voucher/end_voucher",
    description: "Kết thúc voucher ngay lập tức.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/voucher/end_voucher",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/voucher/end_voucher",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "voucher_id",
        type: "int64",
        required: true,
        sample: "1104340665",
        description: "ID định danh duy nhất của voucher mà bạn muốn kết thúc ngay bây giờ.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "034f813abf5e11eb9c4eacde48001122",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Thông tin chi tiết bạn đang truy vấn.",
      },
      {
        name: "response.voucher_id",
        type: "int64",
        sample: "1104340665",
        description: "ID duy nhất của voucher đang được kết thúc.",
      },
    ],
  },
  {
    id: "update-voucher",
    module: "voucher",
    name: "v2.voucher.update_voucher",
    method: "POST",
    path: "/api/v2/voucher/update_voucher",
    description: "Cập nhật thông tin voucher.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/voucher/update_voucher",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/voucher/update_voucher",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "voucher_id",
        type: "int64",
        required: true,
        sample: "123",
        description: "ID định danh duy nhất của voucher cần cập nhật.",
      },
      {
        name: "voucher_name",
        type: "string",
        required: false,
        sample: "test",
        description: "Tên của voucher.",
      },
      {
        name: "start_time",
        type: "timestamp",
        required: false,
        sample: "1624327200",
        description: "Thời gian từ khi voucher có hiệu lực; người mua được phép thu thập và sử dụng. Trường này chỉ có thể được cập nhật nếu voucher chưa bắt đầu.",
      },
      {
        name: "end_time",
        type: "timestamp",
        required: false,
        sample: "1632448798",
        description: "Thời gian cho đến khi voucher hết hiệu lực. Sau thời gian này, người mua không được thu thập hay sử dụng.",
      },
      {
        name: "usage_quantity",
        type: "int32",
        required: false,
        sample: "11",
        description: "Số lần chứng từ này có thể được sử dụng.",
      },
      {
        name: "min_basket_price",
        type: "float",
        required: false,
        sample: "1.0",
        description: "Số tiền chi tiêu tối thiểu bắt buộc để sử dụng voucher này.",
      },
      {
        name: "discount_amount",
        type: "float",
        required: false,
        sample: "1.0",
        description: "Số tiền giảm giá được thiết lập cho voucher này. Chỉ điền vào khi bạn đang cập nhật voucher có số tiền cố định.",
      },
      {
        name: "percentage",
        type: "int32",
        required: false,
        sample: "11",
        description: "Tỷ lệ phần trăm giảm giá được đặt cho voucher này. Chỉ điền khi bạn cập nhật voucher phần trăm giảm giá hoặc voucher hoàn tiền(coin cashback).",
      },
      {
        name: "max_price",
        type: "float",
        required: false,
        sample: "1.0",
        description: "Số tiền giảm giá/giá trị tối đa mà người dùng có thể nhận được bằng cách sử dụng voucher này. Chỉ điền khi bạn cập nhật voucher phần trăm giảm giá hoặc voucher hoàn tiền(coin cashback).",
      },
      {
        name: "display_channel_list",
        type: "int32[]",
        required: false,
        sample: "[3,4]",
        description: "Kênh FE nơi voucher sẽ được hiển thị. Các giá trị khả dụng là: 1: display_all, 2: order page, 3: feed, 4: live streaming, [] (trống - bị ẩn).",
      },
      {
        name: "item_id_list",
        type: "int64[]",
        required: false,
        sample: "[121331,12332323]",
        description: "Danh sách sản phẩm áp dụng được voucher này. Chỉ điền khi bạn đang cập nhật voucher loại product.",
      },
      {
        name: "display_start_time",
        type: "int64",
        required: false,
        sample: "162078900",
        description: "Thời gian voucher được hiển thị trên trang cửa hàng để người mua có thể lấy.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "7d23ab68bf7b11eba385acde48001122",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Thông tin chi tiết bạn đang truy vấn.",
      },
      {
        name: "response.voucher_id",
        type: "int64",
        sample: "123",
        description: "ID duy nhất của voucher đang được cập nhật.",
      },
    ],
  },
  {
    id: "get-voucher",
    module: "voucher",
    name: "v2.voucher.get_voucher",
    method: "GET",
    path: "/api/v2/voucher/get_voucher",
    description: "Lấy chi tiết voucher.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/voucher/get_voucher",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/voucher/get_voucher",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "voucher_id",
        type: "int64",
        required: true,
        sample: "123",
        description: "ID định danh duy nhất của voucher, dùng để truy vấn chi tiết voucher.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "6737a37ec1b111ebb75cecde68201122",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Thông tin chi tiết bạn đang truy vấn.",
      },
      {
        name: "response.voucher_id",
        type: "int64",
        sample: "123",
        description: "ID duy nhất của voucher có thông tin chi tiết được trả về.",
      },
      {
        name: "response.voucher_code",
        type: "string",
        sample: "MKTXFH40",
        description: "Mã voucher",
      },
      {
        name: "response.voucher_name",
        type: "string",
        sample: "test",
        description: "Tên voucher",
      },
      {
        name: "response.voucher_type",
        type: "int32",
        sample: "1",
        description: "Loại voucher. Có thể là: 1: shop voucher, 2: product voucher.",
      },
      {
        name: "response.reward_type",
        type: "int32",
        sample: "1",
        description: "Loại phần thưởng. Có thể là: 1: fix_amount, 2: discount_percentage, 3: coin_cashback.",
      },
      {
        name: "response.usage_quantity",
        type: "int32",
        sample: "1",
        description: "Số lần voucher này có thể được sử dụng.",
      },
      {
        name: "response.current_usage",
        type: "int32",
        sample: "0",
        description: "Cho đến nay, số lần voucher này đã được sử dụng.",
      },
      {
        name: "response.start_time",
        type: "timestamp",
        sample: "1632188837",
        description: "Thời gian khi voucher có hiệu lực; người mua được phép thu thập và sử dụng.",
      },
      {
        name: "response.end_time",
        type: "timestamp",
        sample: "1632801337",
        description: "Thời gian voucher hết hiệu lực. Bất kỳ lúc nào sau end_time người mua không được thu thập hay sử dụng.",
      },
      {
        name: "response.is_admin",
        type: "boolean",
        sample: "false",
        description: "Có phải voucher tạo bởi Shopee hay không.",
      },
      {
        name: "response.voucher_purpose",
        type: "int32",
        sample: "0",
        description: "Trường hợp sử dụng voucher. Giá trị có thể: 0: normal, 1: welcome, 2: referral, 3: shop_follow, 4: shop_game, 5: free_gift, 6: membership, 7: Ads.",
      },
      {
        name: "response.display_channel_list",
        type: "int32[]",
        sample: "[1, 2]",
        description: "Kênh front-end nơi voucher sẽ xuất hiện. 1: display_all, 2: seller page, 3: feed, 4: live streaming, []: trống = bị ẩn (hidden).",
      },
      {
        name: "response.min_basket_price",
        type: "float",
        sample: "10.1",
        description: "Mức chi tiêu tối thiểu yêu cầu để sử dụng voucher này.",
      },
      {
        name: "response.percentage",
        type: "int32",
        sample: "22",
        description: "Phần trăm giảm. Chỉ trả về giá trị nếu là voucher discount_percentage hoặc coin_cashback.",
      },
      {
        name: "response.max_price",
        type: "float",
        sample: "11.1",
        description: "Số tiền giảm/nhận tối đa người dùng được hưởng thông qua sử dụng voucher.",
      },
      {
        name: "response.discount_amount",
        type: "float",
        sample: "11.0",
        description: "Số tiền giảm giá. Chỉ trả về giá trị nếu đây là voucher số tiền cố định (fix_amount).",
      },
      {
        name: "response.cmt_voucher_status",
        type: "int32",
        sample: "1",
        description: "Trạng thái voucher CMT: 1: review, 2: approved, 3: reject. Chỉ trả về khi đang đợi CMT campaign và không bị loại.",
      },
      {
        name: "response.item_id_list",
        type: "int64[]",
        sample: "[123423, 122311]",
        description: "Danh sách sản phẩm áp dụng được voucher. Chỉ trả về nếu đây là product type voucher.",
      },
      {
        name: "response.display_start_time",
        type: "timestamp",
        sample: "163078800",
        description: "Thời gian voucher xuất hiện trên trang của shop cho người mua thu thập.",
      },
      {
        name: "response.target_voucher",
        type: "int32",
        description: "Đánh dấu voucher cho người dùng mới / khách lặp lại. 1: new user voucher, 2: repeat buyer voucher with 1 orders, 3: repeat buyer voucher with 2 orders.",
      },
      {
        name: "response.usecase",
        type: "int32",
        description: "Mục đích sử dụng voucher. Có thể: 1: shop, 2: product, 3: new buyer, 4: repeat buyer, 5: private, 6: live, 7: video, 8: campaign, 9: follow prize, 10: membership, 11: game prize, 12: sample voucher.",
      },
    ],
  },
  {
    id: "get-voucher-list",
    module: "voucher",
    name: "v2.voucher.get_voucher_list",
    method: "GET",
    path: "/api/v2/voucher/get_voucher_list",
    description:
      "Dùng để lấy danh sách voucher theo điều kiện phân trang và trạng thái.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/voucher/get_voucher_list",
      },
      {
        name: "Test URL",
        url: "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/voucher/get_voucher_list",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description:
          "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "page_no",
        type: "int32",
        required: false,
        sample: "1",
        description:
          "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Mặc định là 1 và đầu vào cho phép là từ 1 - 5000.",
      },
      {
        name: "page_size",
        type: "int32",
        required: false,
        sample: "100",
        description:
          "Chỉ định số lượng mục tối đa trả về mỗi trang (mỗi lần gọi). Mặc định là 20 và đầu vào cho phép là từ 1 - 100.",
      },
      {
        name: "status",
        type: "string",
        required: true,
        sample: "all",
        description:
          "Lọc trạng thái để lấy danh sách voucher. Giá trị có thể: upcoming/ongoing/expired/all.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description:
          "Loại lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description:
          "Chi tiết lỗi nếu có. Trống nếu không có lỗi.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "c926b49d489a143f415e7197adc9686b",
        description:
          "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Thông tin chi tiết bạn đang truy vấn.",
      },
      {
        name: "response.more",
        type: "boolean",
        sample: "true",
        description: "Cho biết danh sách phân trang còn không. Nếu 'true', có thể gọi trang kế tiếp.",
      },
      {
        name: "response.voucher_list",
        type: "object[]",
        description: "Danh sách voucher.",
      },
      {
        name: "response.voucher_list[].voucher_id",
        type: "int64",
        sample: "395841407827968",
        description: "ID duy nhất cho một voucher.",
      },
      {
        name: "response.voucher_list[].voucher_code",
        type: "string",
        sample: "TESTTEST1",
        description: "Mã voucher.",
      },
      {
        name: "response.voucher_list[].voucher_name",
        type: "string",
        sample: "test voucher",
        description: "Tên voucher.",
      },
      {
        name: "response.voucher_list[].voucher_type",
        type: "int32",
        sample: "1",
        description: "Loại voucher. Có thể là: 1: shop voucher, 2: product voucher.",
      },
      {
        name: "response.voucher_list[].reward_type",
        type: "int32",
        sample: "1",
        description: "Loại phần thưởng. Có thể là: 1: fix_amount, 2: discount_percentage, 3: coin_cashback.",
      },
      {
        name: "response.voucher_list[].usage_quantity",
        type: "int32",
        sample: "11",
        description: "Số lần voucher này có thể được sử dụng.",
      },
      {
        name: "response.voucher_list[].current_usage",
        type: "int32",
        sample: "0",
        description: "Cho đến nay, số lần voucher này đã được sử dụng.",
      },
      {
        name: "response.voucher_list[].start_time",
        type: "timestamp",
        sample: "1658647700",
        description: "Thời gian khi voucher có hiệu lực; người mua được phép thu thập và sử dụng.",
      },
      {
        name: "response.voucher_list[].end_time",
        type: "timestamp",
        sample: "1659243300",
        description: "Thời gian voucher hết hiệu lực. Sau end_time, không thể sử dụng hay thu thập.",
      },
      {
        name: "response.voucher_list[].is_admin",
        type: "boolean",
        sample: "false",
        description: "Có phải voucher tạo bởi Shopee hay không.",
      },
      {
        name: "response.voucher_list[].voucher_purpose",
        type: "int32",
        sample: "0",
        description: "Trường hợp sử dụng voucher. 0: normal, 1: welcome, 2: referral, 3: shop_follow, 4: shop_game, 5: free_gift, 6: membership.",
      },
      {
        name: "response.voucher_list[].discount_amount",
        type: "float",
        sample: "60.0",
        description: "Số tiền giảm giá. Chỉ trả về giá trị nếu đây là voucher số tiền cố định (fix_amount).",
      },
      {
        name: "response.voucher_list[].percentage",
        type: "int32",
        sample: "10",
        description: "Phần trăm giảm. Chỉ trả về giá trị nếu là voucher discount_percentage hoặc coin_cashback.",
      },
      {
        name: "response.voucher_list[].cmt_voucher_status",
        type: "int32",
        sample: "1",
        description: "Trạng thái voucher CMT: 1: review, 2: approved, 3: reject. Chỉ trả về khi đang đợi CMT campaign và không bị loại.",
      },
      {
        name: "response.voucher_list[].display_start_time",
        type: "timestamp",
        sample: "1638342000",
        description: "Thời gian voucher được hiển thị để user lấy trên trang shop.",
      },
    ],
  },
  {
    id: "get-access-token",
    module: "public",
    name: "v2.public.get_access_token",
    method: "POST",
    path: "/api/v2/auth/token/get",
    description:
      "Dùng mã code từ bước xác thực (authorization) để lấy shop_id, merchant_id, supplier_id hoặc user_id đã được uỷ quyền, cùng với access_token và refresh_token tương ứng.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/auth/token/get",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "code",
        type: "string",
        required: true,
        sample: "5a5477794a55537954...",
        description:
          "Mã code trong redirect URL sau khi xác thực. Dùng một lần, hết hạn sau 10 phút.",
      },
      {
        name: "partner_id",
        type: "int64",
        required: true,
        sample: "1001141",
        description: "ID đối tác. Bắt buộc cho mỗi request.",
      },
      {
        name: "shop_id",
        type: "int64",
        required: false,
        description: "ID định danh duy nhất của shop trên Shopee.",
      },
      {
        name: "main_account_id",
        type: "int64",
        required: false,
        description:
          "ID tài khoản chính của người bán đã uỷ quyền cho developer.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description: "Mã lỗi. Luôn trả về. Khi thành công thì rỗng.",
      },
      {
        name: "message",
        type: "string",
        description: "Thông tin lỗi chi tiết. Luôn trả về.",
      },
      {
        name: "request_id",
        type: "string",
        description:
          "ID của request. Luôn trả về. Dùng để debug/xử lý sự cố.",
      },
      {
        name: "shop_id_list",
        type: "int64[]",
        description:
          "Danh sách tất cả shop_id được uỷ quyền trong lần này.",
      },
      {
        name: "merchant_id_list",
        type: "int64[]",
        description:
          "Danh sách tất cả merchant_id được uỷ quyền trong lần này.",
      },
      {
        name: "supplier_id_list",
        type: "int64[]",
        description:
          "Danh sách tất cả supplier_id được uỷ quyền trong lần này.",
      },
      {
        name: "user_id_list",
        type: "int64[]",
        description:
          "Danh sách tất cả user_id được uỷ quyền trong lần này.",
      },
      {
        name: "access_token",
        type: "string",
        description:
          "Token truy cập. Trả về khi thành công. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "refresh_token",
        type: "string",
        description:
          "Token làm mới. Dùng để lấy access_token mới. Có hiệu lực 30 ngày cho mỗi shop_id/merchant_id/supplier_id/user_id.",
      },
      {
        name: "expire_in",
        type: "timestamp",
        description:
          "Thời gian hiệu lực của access_token, tính bằng giây.",
      },
    ],
  },
  {
    id: "refresh-access-token",
    module: "public",
    name: "v2.public.refresh_access_token",
    method: "POST",
    path: "/api/v2/auth/access_token/get",
    description:
      "Dùng để làm mới access_token sau khi hết hạn. refresh_token chỉ dùng được một lần, API này cũng sẽ trả về refresh_token mới. Hãy dùng refresh_token mới cho lần gọi RefreshAccessToken tiếp theo.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/auth/access_token/get",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "refresh_token",
        type: "string",
        required: true,
        sample: "4c7259534969484e71734d695a6e6d55",
        description:
          "Dùng refresh_token để lấy access_token mới. Mỗi refresh_token có hiệu lực 30 ngày, chỉ dùng được một lần bởi một shop_id hoặc merchant_id hoặc supplier_id hoặc user_id.",
      },
      {
        name: "partner_id",
        type: "int64",
        required: true,
        sample: "2001887",
        description:
          "ID đối tác lấy từ App. partner_id này được đưa vào body request.",
      },
      {
        name: "shop_id",
        type: "int64",
        required: false,
        sample: "322300222",
        description:
          "shop_id đã uỷ quyền cho App. Chỉ được chọn một trong shop_id, merchant_id, supplier_id hoặc user_id làm tham số đầu vào, và phải làm mới riêng biệt.",
      },
      {
        name: "merchant_id",
        type: "int64",
        required: false,
        description:
          "merchant_id đã uỷ quyền cho App. Chỉ được chọn một trong shop_id, merchant_id, supplier_id hoặc user_id, và phải làm mới riêng biệt.",
      },
      {
        name: "supplier_id",
        type: "int64",
        required: false,
        description:
          "supplier_id đã uỷ quyền cho App. Chỉ được chọn một trong shop_id, merchant_id, supplier_id hoặc user_id, và phải làm mới riêng biệt.",
      },
      {
        name: "user_id",
        type: "int64",
        required: false,
        description:
          "user_id đã uỷ quyền cho App. Chỉ được chọn một trong shop_id, merchant_id, supplier_id hoặc user_id, và phải làm mới riêng biệt.",
      },
    ],
    responseParams: [
      {
        name: "error",
        type: "string",
        description:
          "Loại lỗi. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description:
          "Chi tiết lỗi. Rỗng nếu không có lỗi.",
      },
      {
        name: "request_id",
        type: "string",
        description:
          "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "partner_id",
        type: "int64",
        description:
          "Trả về khi gọi API thành công. partner_id bạn đã dùng cho lần làm mới này.",
      },
      {
        name: "shop_id",
        type: "int64",
        description:
          "Trả về khi gọi API thành công. shop_id cho lần làm mới này.",
      },
      {
        name: "merchant_id",
        type: "int64",
        description:
          "Trả về khi gọi API thành công. merchant_id cho lần làm mới này.",
      },
      {
        name: "supplier_id",
        type: "int64",
        description:
          "Trả về khi gọi API thành công. supplier_id cho lần làm mới này.",
      },
      {
        name: "user_id",
        type: "int64",
        description:
          "Trả về khi gọi API thành công. user_id cho lần làm mới này.",
      },
      {
        name: "access_token",
        type: "string",
        description:
          "Trả về khi gọi API thành công. Mỗi access_token mới là token động, có thể dùng nhiều lần. Hết hạn sau 4 giờ.",
      },
      {
        name: "refresh_token",
        type: "string",
        description:
          "refresh_token mới. Trả về khi gọi API thành công. Dùng refresh_token để lấy access_token mới. Mỗi refresh_token có hiệu lực 30 ngày, chỉ dùng được một lần bởi một shop_id hoặc merchant_id hoặc supplier_id hoặc user_id.",
      },
      {
        name: "expire_in",
        type: "timestamp",
        description:
          "Trả về khi gọi API thành công. Thời gian hiệu lực của access_token, tính bằng giây.",
      },
    ],
  },
  {
    id: "get-shops-by-partner",
    module: "public",
    name: "v2.public.get_shops_by_partner",
    method: "GET",
    path: "/api/v2/public/get_shops_by_partner",
    description:
      "Lấy thông tin cơ bản của các shop đã uỷ quyền cho đối tác (partner).",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/public/get_shops_by_partner",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "page_size",
        type: "int",
        required: false,
        sample: "1",
        description:
          "Mỗi tập kết quả được trả về dưới dạng phân trang. Dùng \"page_size\" để chỉ định số lượng mục tối đa trả về mỗi trang (mỗi lần gọi), và \"page_no\" để bắt đầu lần gọi tiếp theo. Giá trị này dùng để xác định số mục tối đa trả về trong một \"trang\" dữ liệu.",
      },
      {
        name: "page_no",
        type: "int",
        required: false,
        sample: "1",
        description:
          "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Bắt đầu từ 1. Nếu dữ liệu có nhiều hơn một trang, page_no có thể là giá trị bất kỳ để bắt đầu lần gọi tiếp theo.",
      },
    ],
    responseParams: [
      {
        name: "authed_shop_list",
        type: "object[]",
        description:
          "Danh sách các shop đã uỷ quyền cho đối tác.",
      },
      {
        name: "authed_shop_list[].region",
        type: "string",
        sample: "SG",
        description: "Khu vực của shop.",
      },
      {
        name: "authed_shop_list[].shop_id",
        type: "int",
        sample: "123",
        description: "ID của shop.",
      },
      {
        name: "authed_shop_list[].auth_time",
        type: "timestamp",
        sample: "1610533441",
        description:
          "Thời điểm shop uỷ quyền cho đối tác (Unix timestamp).",
      },
      {
        name: "authed_shop_list[].expire_time",
        type: "timestamp",
        sample: "1642069441",
        description:
          "Thời điểm hết hạn uỷ quyền của shop.",
      },
      {
        name: "sip_affi_shop_list",
        type: "object[]",
        description: "Danh sách thông tin shop liên kết SIP.",
      },
      {
        name: "sip_affi_shop_list[].region",
        type: "string",
        sample: "SG",
        description: "Khu vực của shop liên kết.",
      },
      {
        name: "sip_affi_shop_list[].affi_shop_id",
        type: "int",
        sample: "261377",
        description: "ID của shop liên kết.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "0b8f39a76e6ada92247b416c768363ee",
        description:
          "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "more",
        type: "boolean",
        sample: "true",
        description:
          "Cho biết danh sách có nhiều hơn một trang hay không. Nếu giá trị là true, bạn nên tiếp tục gọi trang tiếp theo để lấy phần dữ liệu còn lại.",
      },
    ],
  },
  {
    id: "get-merchants-by-partner",
    module: "public",
    name: "v2.public.get_merchants_by_partner",
    method: "GET",
    path: "/api/v2/public/get_merchants_by_partner",
    description:
      "Lấy thông tin cơ bản của các merchant đã uỷ quyền cho đối tác (partner).",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/public/get_merchants_by_partner",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "page_size",
        type: "int",
        required: false,
        sample: "1",
        description:
          "Mỗi tập kết quả được trả về dưới dạng phân trang. Dùng \"page_size\" để chỉ định số lượng mục tối đa trả về mỗi trang (mỗi lần gọi), và \"page_no\" để bắt đầu lần gọi tiếp theo. Giá trị này dùng để xác định số mục tối đa trả về trong một \"trang\" dữ liệu.",
      },
      {
        name: "page_no",
        type: "int",
        required: false,
        sample: "1",
        description:
          "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Bắt đầu từ 1. Nếu dữ liệu có nhiều hơn một trang, page_no có thể là giá trị bất kỳ để bắt đầu lần gọi tiếp theo.",
      },
    ],
    responseParams: [
      {
        name: "authed_merchant_list",
        type: "object[]",
        description:
          "Danh sách các merchant đã uỷ quyền cho đối tác.",
      },
      {
        name: "authed_merchant_list[].region",
        type: "string",
        sample: "SG",
        description: "Khu vực của merchant.",
      },
      {
        name: "authed_merchant_list[].merchant_id",
        type: "int",
        sample: "1",
        description: "ID định danh duy nhất của merchant trên Shopee.",
      },
      {
        name: "authed_merchant_list[].auth_time",
        type: "timestamp",
        sample: "123",
        description:
          "Thời điểm merchant uỷ quyền cho đối tác (Unix timestamp).",
      },
      {
        name: "authed_merchant_list[].expire_time",
        type: "timestamp",
        sample: "12312",
        description:
          "Thời điểm hết hạn uỷ quyền của merchant.",
      },
      {
        name: "request_id",
        type: "string",
        sample: "asdasq",
        description:
          "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "more",
        type: "boolean",
        sample: "false",
        description:
          "Cho biết danh sách có nhiều hơn một trang hay không. Nếu giá trị là true, bạn nên tiếp tục gọi trang tiếp theo để lấy phần dữ liệu còn lại.",
      },
      {
        name: "error",
        type: "string",
        description:
          "Loại lỗi. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description:
          "Chi tiết lỗi. Rỗng nếu không có lỗi.",
      },
    ],
  },
  {
    id: "get-token-by-resend-code",
    module: "public",
    name: "v2.public.get_token_by_resend_code",
    method: "POST",
    path: "/api/v2/public/get_token_by_resend_code",
    description:
      "Dùng resend code để lấy access token và refresh token. Khi bạn bị mất access_token hoặc refresh_token, có thể vào trang quản lý uỷ quyền (authorization management) để gửi lại code. Chỉ dùng được trên môi trường thật (live), không hỗ trợ trên môi trường test-stable.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/public/get_token_by_resend_code",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "resend_code",
        type: "string",
        required: true,
        sample: "resend5a4d6e6a7a745a767276586f53476849",
        description:
          "Mã code trong redirect URL sau khi bạn gửi lại code (resend code) trên trang quản lý uỷ quyền shop. Chỉ dùng một lần, hết hạn sau 10 phút.",
      },
    ],
    responseParams: [
      {
        name: "request_id",
        type: "string",
        sample: "a3a4277823b1019960cc92cfd972c506",
        description:
          "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "error",
        type: "string",
        sample: "common.error_auth",
        description: "Loại lỗi khi xảy ra lỗi.",
      },
      {
        name: "message",
        type: "string",
        sample: "Invalid access_token.",
        description: "Chi tiết lỗi khi xảy ra lỗi.",
      },
      {
        name: "shop_id_list",
        type: "int[]",
        sample: "[1]",
        description:
          "Trả về khi resend code ở module shop.",
      },
      {
        name: "merchant_id_list",
        type: "int[]",
        sample: "[1]",
        description:
          "Trả về khi resend code ở module merchant.",
      },
      {
        name: "refresh_token",
        type: "string",
        sample: "abcd",
        description:
          "Dùng refresh_token để lấy access_token mới. Có hiệu lực cho mỗi shop_id và merchant_id, chỉ dùng một lần, hết hạn sau 30 ngày.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "abcd",
        description:
          "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "expire_in",
        type: "int",
        sample: "123",
        description:
          "Thời gian hiệu lực của access_token, tính bằng giây.",
      },
    ],
  },
  {
    id: "get-shopee-ip-ranges",
    module: "public",
    name: "v2.public.get_shopee_ip_ranges",
    method: "GET",
    path: "/api/v2/public/get_shopee_ip_ranges",
    description:
      "Lấy danh sách dải địa chỉ IP của Shopee thông qua API này.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/public/get_shopee_ip_ranges",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [],
    responseParams: [
      {
        name: "request_id",
        type: "string",
        sample: "a3a4277823b1019960cc92cfd972c506",
        description:
          "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "error",
        type: "string",
        description:
          "Loại lỗi. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description:
          "Chi tiết lỗi. Rỗng nếu không có lỗi.",
      },
      {
        name: "ip_list",
        type: "string[]",
        sample: "[\"1.1.1.1/24\",\"2.2.2.212/24\"]",
        description:
          "Danh sách dải địa chỉ IP của Shopee.",
      },
    ],
  },
  {
    id: "flash-sale-get-time-slot-id",
    module: "flash_sale",
    name: "v2.shop_flash_sale.get_time_slot_id",
    method: "GET",
    path: "/api/v2/shop_flash_sale/get_time_slot_id",
    description:
      "Lấy danh sách time slot ID khả dụng cho Flash Sale trong khoảng thời gian chỉ định.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_time_slot_id",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description:
          "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description:
          "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description:
          "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description:
          "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "start_time",
        type: "timestamp",
        required: true,
        sample: "1721978628",
        description:
          "Thời điểm bắt đầu tìm kiếm time slot. min = now (hiện tại), max = 2145887999. Phải nhỏ hơn end_time.",
      },
      {
        name: "end_time",
        type: "timestamp",
        required: true,
        sample: "1727335428",
        description:
          "Thời điểm kết thúc tìm kiếm time slot. Phải lớn hơn start_time. max = 2145887999.",
      },
    ],
    responseParams: [
      {
        name: "request_id",
        type: "string",
        description:
          "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "error",
        type: "string",
        description:
          "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description:
          "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "response",
        type: "object[]",
        description: "Danh sách các time slot khả dụng cho Flash Sale.",
      },
      {
        name: "response[].timeslot_id",
        type: "int64",
        description: "ID định danh của time slot Flash Sale.",
      },
      {
        name: "response[].start_time",
        type: "timestamp",
        sample: "1721978628",
        description: "Thời điểm bắt đầu của time slot.",
      },
      {
        name: "response[].end_time",
        type: "timestamp",
        sample: "1727335428",
        description: "Thời điểm kết thúc của time slot.",
      },
    ],
  },
  {
    id: "flash-sale-create-shop-flash-sale",
    module: "flash_sale",
    name: "v2.shop_flash_sale.create_shop_flash_sale",
    method: "POST",
    path: "/api/v2/shop_flash_sale/create_shop_flash_sale",
    description: "Tạo một chương trình Flash Sale cho shop.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/create_shop_flash_sale",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "timeslot_id",
        type: "int64",
        required: true,
        description:
          "ID của time slot Flash Sale. Lấy từ API v2.shop_flash_sale.get_time_slot_id. Chỉ được dùng timeslot có start_time > now (hiện tại).",
      },
    ],
    responseParams: [
      {
        name: "request_id",
        type: "string",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Thông tin Flash Sale vừa được tạo.",
      },
      {
        name: "response.timeslot_id",
        type: "int64",
        description: "ID của time slot được gán cho Flash Sale.",
      },
      {
        name: "response.flash_sale_id",
        type: "int64",
        description: "ID định danh duy nhất của Flash Sale vừa tạo.",
      },
      {
        name: "response.status",
        type: "int32",
        sample: "1",
        description:
          "Trạng thái của Flash Sale: 0 = deleted (đã xoá), 1 = enabled (đang hoạt động), 2 = disabled (bị tắt), 3 = system_rejected (bị hệ thống từ chối).",
      },
    ],
  },
  {
    id: "flash-sale-get-item-criteria",
    module: "flash_sale",
    name: "v2.shop_flash_sale.get_item_criteria",
    method: "GET",
    path: "/api/v2/shop_flash_sale/get_item_criteria",
    description: "Lấy tiêu chí sản phẩm (item criteria) cho chương trình Flash Sale của shop.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_item_criteria",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [],
    responseParams: [
      {
        name: "request_id",
        type: "string",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Dữ liệu tiêu chí Flash Sale.",
      },
      {
        name: "response.criteria",
        type: "object[]",
        description: "Danh sách tiêu chí chi tiết áp dụng cho sản phẩm tham gia Flash Sale.",
      },
      {
        name: "response.criteria[].criteria_id",
        type: "int64",
        description: "ID định danh của tiêu chí.",
      },
      {
        name: "response.criteria[].min_product_rating",
        type: "float",
        description: "Điểm đánh giá sản phẩm tối thiểu (0.0–5.0). -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].min_likes",
        type: "int32",
        description: "Số lượt thích tối thiểu. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].must_not_pre_order",
        type: "boolean",
        sample: "true",
        description: "Sản phẩm không được là Pre-Order (đặt trước).",
      },
      {
        name: "response.criteria[].min_order_total",
        type: "int32",
        description: "Số đơn hàng tối thiểu trong 30 ngày gần nhất. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].max_days_to_ship",
        type: "int32",
        description: "Số ngày giao hàng tối đa. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].min_repetition_day",
        type: "int32",
        description: "Kiểm soát lặp lại: cùng một sản phẩm không được tham gia ISFS trong vòng N ngày. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].min_promo_stock",
        type: "int32",
        sample: "1",
        description: "Số lượng hàng khuyến mãi tối thiểu. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].max_promo_stock",
        type: "int32",
        sample: "10",
        description: "Số lượng hàng khuyến mãi tối đa. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].min_discount",
        type: "int64",
        sample: "10",
        description: "Mức giảm giá tối thiểu. Ví dụ: 10 = 10%. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].max_discount",
        type: "int64",
        sample: "100",
        description: "Mức giảm giá tối đa. Ví dụ: 100 = 100%. -1 nghĩa là không giới hạn.",
      },
      {
        name: "response.criteria[].min_discount_price",
        type: "int64",
        sample: "10000000",
        description: "Giá giảm tối thiểu. -1 nghĩa là không giới hạn. Giá thực = min_discount_price / 100000.",
      },
      {
        name: "response.criteria[].max_discount_price",
        type: "int64",
        sample: "100000000",
        description: "Giá giảm tối đa. -1 nghĩa là không giới hạn. Giá thực = max_discount_price / 100000.",
      },
      {
        name: "response.criteria[].need_lowest_price",
        type: "boolean",
        sample: "true",
        description: "Giá phải thấp hơn giá thấp nhất trong 7 ngày qua (không tính Shopee Flash Deals).",
      },
      {
        name: "response.pair_ids",
        type: "object[]",
        description: "Quan hệ mapping giữa tiêu chí và danh mục sản phẩm.",
      },
      {
        name: "response.pair_ids[].criteria_id",
        type: "int64",
        description: "ID tiêu chí tương ứng.",
      },
      {
        name: "response.pair_ids[].category_list",
        type: "object[]",
        description: "Các danh mục của shop có sản phẩm, tiêu chí sẽ áp dụng cho các danh mục này.",
      },
      {
        name: "response.pair_ids[].category_list[].category_id",
        type: "int64",
        description: "ID danh mục. 0 nghĩa là tất cả danh mục.",
      },
      {
        name: "response.pair_ids[].category_list[].name",
        type: "string",
        description: "Tên danh mục.",
      },
      {
        name: "response.pair_ids[].category_list[].parent_id",
        type: "int64",
        description: "ID danh mục cha. 0 nghĩa là danh mục cấp L1.",
      },
      {
        name: "response.overlap_block_category_ids",
        type: "int64[]",
        description: "Do quy định, một số danh mục này bị cấm khuyến mãi tại khu vực tương ứng.",
      },
    ],
  },
  {
    id: "flash-sale-add-shop-flash-sale-items",
    module: "flash_sale",
    name: "v2.shop_flash_sale.add_shop_flash_sale_items",
    method: "POST",
    path: "/api/v2/shop_flash_sale/add_shop_flash_sale_items",
    description: "Thêm sản phẩm vào chương trình Flash Sale của shop.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/add_shop_flash_sale_items",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "flash_sale_id",
        type: "int64",
        required: true,
        description: "ID của Flash Sale cần thêm sản phẩm vào.",
      },
      {
        name: "items",
        type: "object[]",
        required: true,
        description: "Danh sách sản phẩm cần thêm vào Flash Sale.",
      },
      {
        name: "items[].item_id",
        type: "int64",
        required: true,
        description: "ID sản phẩm.",
      },
      {
        name: "items[].purchase_limit",
        type: "int32",
        required: true,
        description: "Giới hạn số lượng mua tối đa. min = 0, giá trị 0 nghĩa là không giới hạn.",
      },
      {
        name: "items[].models",
        type: "object[]",
        required: false,
        description: "Danh sách phân loại (variation) của sản phẩm. Bắt buộc nếu sản phẩm có phân loại.",
      },
      {
        name: "items[].models[].model_id",
        type: "int64",
        required: true,
        description: "ID phân loại sản phẩm. Bắt buộc nếu sản phẩm có phân loại.",
      },
      {
        name: "items[].models[].input_promo_price",
        type: "float",
        required: true,
        description: "Giá khuyến mãi của phân loại (chưa bao gồm thuế).",
      },
      {
        name: "items[].models[].stock",
        type: "int32",
        required: true,
        description: "Số lượng hàng trong chiến dịch. min = 1. Có thể lấy từ kho Shopee hoặc kho người bán.",
      },
      {
        name: "items[].item_input_promo_price",
        type: "float",
        required: false,
        description: "Giá khuyến mãi của sản phẩm (chưa bao gồm thuế). Bắt buộc nếu sản phẩm không có phân loại. Không dùng nếu sản phẩm có phân loại.",
      },
      {
        name: "items[].item_stock",
        type: "int32",
        required: false,
        description: "Số lượng hàng trong chiến dịch của sản phẩm. min = 1. Bắt buộc nếu sản phẩm không có phân loại. Không dùng nếu sản phẩm có phân loại.",
      },
    ],
    responseParams: [
      {
        name: "request_id",
        type: "string",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Kết quả thêm sản phẩm vào Flash Sale.",
      },
      {
        name: "response.failed_items",
        type: "object[]",
        description: "Danh sách sản phẩm thêm thất bại.",
      },
      {
        name: "response.failed_items[].item_id",
        type: "int64",
        description: "ID sản phẩm thất bại.",
      },
      {
        name: "response.failed_items[].model_id",
        type: "int64",
        description: "ID phân loại thất bại. Nếu sản phẩm không có phân loại, trường này sẽ rỗng.",
      },
      {
        name: "response.failed_items[].err_code",
        type: "int32",
        description: "Mã lỗi.",
      },
      {
        name: "response.failed_items[].err_msg",
        type: "string",
        description: "Lý do tại sao sản phẩm/phân loại không thể được thêm vào.",
      },
      {
        name: "response.failed_items[].unqualified_conditions",
        type: "object[]",
        description: "Chi tiết các tiêu chí không đạt nếu sản phẩm/phân loại không đáp ứng yêu cầu.",
      },
      {
        name: "response.failed_items[].unqualified_conditions[].unqualified_code",
        type: "int32",
        description: "Mã lỗi cho sản phẩm không đủ tiêu chuẩn.",
      },
      {
        name: "response.failed_items[].unqualified_conditions[].unqualified_msg",
        type: "string",
        description: "Thông báo lỗi cho sản phẩm không đủ tiêu chuẩn.",
      },
    ],
  },
  {
    id: "flash-sale-get-shop-flash-sale-list",
    module: "flash_sale",
    name: "v2.shop_flash_sale.get_shop_flash_sale_list",
    method: "GET",
    path: "/api/v2/shop_flash_sale/get_shop_flash_sale_list",
    description: "Lấy danh sách các chương trình Flash Sale của shop.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_shop_flash_sale_list",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "type",
        type: "int32",
        required: true,
        sample: "1",
        description: "Lọc theo trạng thái Flash Sale: 0 = tất cả, 1 = sắp diễn ra (upcoming), 2 = đang diễn ra (ongoing), 3 = đã kết thúc (expired).",
      },
      {
        name: "start_time",
        type: "timestamp",
        required: false,
        sample: "1721978628",
        description: "Thời điểm bắt đầu lọc. Phải dùng cùng với end_time và phải nhỏ hơn end_time.",
      },
      {
        name: "end_time",
        type: "timestamp",
        required: false,
        sample: "1727335428",
        description: "Thời điểm kết thúc lọc. Phải dùng cùng với start_time và phải lớn hơn start_time.",
      },
      {
        name: "offset",
        type: "int64",
        required: true,
        sample: "0",
        description: "Vị trí bắt đầu lấy dữ liệu. min = 0, max = 1000.",
      },
      {
        name: "limit",
        type: "int64",
        required: true,
        sample: "10",
        description: "Số lượng kết quả tối đa mỗi lần gọi. min = 1, max = 100.",
      },
    ],
    responseParams: [
      {
        name: "request_id",
        type: "string",
        description: "ID định danh của request API, dùng để theo dõi lỗi.",
      },
      {
        name: "error",
        type: "string",
        description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "message",
        type: "string",
        description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi.",
      },
      {
        name: "response",
        type: "object",
        description: "Dữ liệu danh sách Flash Sale.",
      },
      {
        name: "response.total_count",
        type: "int64",
        sample: "10",
        description: "Tổng số chương trình Flash Sale mà shop có.",
      },
      {
        name: "response.flash_sale_list",
        type: "object[]",
        description: "Danh sách các chương trình Flash Sale.",
      },
      {
        name: "response.flash_sale_list[].timeslot_id",
        type: "int64",
        description: "ID của time slot.",
      },
      {
        name: "response.flash_sale_list[].flash_sale_id",
        type: "int64",
        description: "ID của Flash Sale.",
      },
      {
        name: "response.flash_sale_list[].status",
        type: "int32",
        sample: "1",
        description: "Trạng thái: 0 = deleted, 1 = enabled, 2 = disabled, 3 = system_rejected (không thể chỉnh sửa khi ở trạng thái này).",
      },
      {
        name: "response.flash_sale_list[].start_time",
        type: "timestamp",
        sample: "1721978628",
        description: "Thời điểm bắt đầu Flash Sale.",
      },
      {
        name: "response.flash_sale_list[].end_time",
        type: "timestamp",
        sample: "1727335428",
        description: "Thời điểm kết thúc Flash Sale.",
      },
      {
        name: "response.flash_sale_list[].enabled_item_count",
        type: "int32",
        sample: "10",
        description: "Số lượng sản phẩm đang được kích hoạt trong Flash Sale.",
      },
      {
        name: "response.flash_sale_list[].item_count",
        type: "int32",
        sample: "20",
        description: "Tổng số sản phẩm trong Flash Sale.",
      },
      {
        name: "response.flash_sale_list[].type",
        type: "int32",
        sample: "1",
        description: "Trạng thái thời gian: 1 = upcoming (sắp tới), 2 = ongoing (đang diễn ra), 3 = expired (đã kết thúc).",
      },
      {
        name: "response.flash_sale_list[].remindme_count",
        type: "int64",
        sample: "100",
        description: "Số lượt đặt nhắc nhở (reminders).",
      },
      {
        name: "response.flash_sale_list[].click_count",
        type: "int64",
        sample: "200",
        description: "Số lượt click vào sản phẩm.",
      },
    ],
  },
  {
    id: "flash-sale-get-shop-flash-sale",
    module: "flash_sale",
    name: "v2.shop_flash_sale.get_shop_flash_sale",
    method: "GET",
    path: "/api/v2/shop_flash_sale/get_shop_flash_sale",
    description: "Lấy chi tiết một chương trình Flash Sale của shop.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_shop_flash_sale",
      },
    ],
    commonParams: [
      { name: "partner_id", type: "int", sample: "1", description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request." },
      { name: "timestamp", type: "timestamp", sample: "1610000000", description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút." },
      { name: "access_token", type: "string", sample: "c09222e3fc40ffb25fc947f738b1abf1", description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ." },
      { name: "shop_id", type: "int", sample: "600000", description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API." },
      { name: "sign", type: "string", sample: "e318d3e93271991...", description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256." },
    ],
    requestParams: [
      {
        name: "flash_sale_id",
        type: "int64",
        required: true,
        description: "ID của Flash Sale cần lấy chi tiết.",
      },
    ],
    responseParams: [
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "response", type: "object", description: "Chi tiết chương trình Flash Sale." },
      { name: "response.timeslot_id", type: "int64", description: "ID của time slot." },
      { name: "response.flash_sale_id", type: "int64", description: "ID của Flash Sale." },
      {
        name: "response.status",
        type: "int32",
        sample: "1",
        description: "Trạng thái: 0 = deleted, 1 = enabled, 2 = disabled.",
      },
      { name: "response.start_time", type: "timestamp", sample: "1721978628", description: "Thời điểm bắt đầu Flash Sale." },
      { name: "response.end_time", type: "timestamp", sample: "1727335428", description: "Thời điểm kết thúc Flash Sale." },
      { name: "response.enabled_item_count", type: "int32", sample: "10", description: "Số lượng sản phẩm đang được kích hoạt trong Flash Sale." },
      { name: "response.item_count", type: "int32", sample: "20", description: "Tổng số sản phẩm trong Flash Sale." },
      {
        name: "response.type",
        type: "int32",
        sample: "1",
        description: "Trạng thái thời gian: 1 = upcoming (sắp tới), 2 = ongoing (đang diễn ra), 3 = expired (đã kết thúc).",
      },
    ],
  },
  {
    id: "get-shop-flash-sale-items",
    module: "flash_sale",
    name: "v2.shop_flash_sale.get_shop_flash_sale_items",
    method: "GET",
    path: "/api/v2/shop_flash_sale/get_shop_flash_sale_items",
    description: "Lấy danh sách sản phẩm trong một chương trình Flash Sale của shop.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/get_shop_flash_sale_items",
      },
    ],
    commonParams: [
      { name: "partner_id", type: "int", sample: "1", description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request." },
      { name: "timestamp", type: "timestamp", sample: "1610000000", description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút." },
      { name: "access_token", type: "string", sample: "c09222e3fc40ffb25fc947f738b1abf1", description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ." },
      { name: "shop_id", type: "int", sample: "600000", description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API." },
      { name: "sign", type: "string", sample: "e318d3e93271991...", description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256." },
    ],
    requestParams: [
      {
        name: "flash_sale_id",
        type: "int64",
        required: true,
        description: "ID của Flash Sale cần lấy danh sách sản phẩm.",
      },
      {
        name: "offset",
        type: "int64",
        required: true,
        sample: "0",
        description: "Vị trí bắt đầu của trang kết quả. min=0, max=1000.",
      },
      {
        name: "limit",
        type: "int64",
        required: true,
        sample: "10",
        description: "Số lượng kết quả trả về mỗi trang. min=1, max=100.",
      },
    ],
    responseParams: [
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "response", type: "object", description: "Dữ liệu danh sách sản phẩm Flash Sale." },
      { name: "response.total_count", type: "int64", description: "Tổng số sản phẩm trong Flash Sale." },
      { name: "response.models", type: "object[]", description: "Thông tin variation của sản phẩm. Chỉ có giá trị khi sản phẩm có biến thể." },
      { name: "response.models[].item_id", type: "int64", description: "ID của sản phẩm." },
      { name: "response.models[].model_id", type: "int64", description: "ID của biến thể (variation)." },
      { name: "response.models[].model_name", type: "string", description: "Tên biến thể." },
      {
        name: "response.models[].status",
        type: "int32",
        sample: "1",
        description: "Trạng thái biến thể trong Flash Sale: 0 = disable, 1 = enable, 2 = delete, 4 = system_rejected, 5 = manual_rejected.",
      },
      { name: "response.models[].original_price", type: "float", description: "Giá gốc của biến thể." },
      { name: "response.models[].input_promotion_price", type: "float", description: "Giá khuyến mãi chưa bao gồm thuế." },
      { name: "response.models[].promotion_price_with_tax", type: "float", description: "Giá khuyến mãi đã bao gồm thuế." },
      { name: "response.models[].purchase_limit", type: "int64", description: "Giới hạn số lượng mua. 0 = không giới hạn." },
      { name: "response.models[].campaign_stock", type: "int64", description: "Tồn kho dành riêng cho Flash Sale." },
      { name: "response.models[].stock", type: "int64", description: "Tồn kho hiện hoạt (active inventory)." },
      { name: "response.models[].reject_reason", type: "string", description: "Lý do từ chối, có giá trị khi status là 4 hoặc 5." },
      { name: "response.models[].unqualified_conditions", type: "object", description: "Điều kiện không đủ tiêu chuẩn (nếu sản phẩm không đáp ứng tiêu chí)." },
      { name: "response.models[].unqualified_conditions.unqualified_code", type: "int32", description: "Mã lý do không đủ tiêu chuẩn." },
      { name: "response.models[].unqualified_conditions.unqualified_msg", type: "string", description: "Mô tả lý do không đủ tiêu chuẩn." },
      { name: "response.item_info", type: "object[]", description: "Thông tin sản phẩm trong Flash Sale. Nếu sản phẩm có biến thể, các trường về giá/tồn kho sẽ trống." },
      { name: "response.item_info[].item_id", type: "int64", description: "ID của sản phẩm." },
      { name: "response.item_info[].item_name", type: "string", description: "Tên sản phẩm." },
      {
        name: "response.item_info[].status",
        type: "int32",
        sample: "1",
        description: "Trạng thái sản phẩm trên Shopee: 0 = Deleted, 1 = Normal, 2 = reviewing, 3 = banned, 4 = invalid, 5 = invalid hide, 6 = offensive hide, 7 = auditing, 8 = normal unlist.",
      },
      { name: "response.item_info[].image", type: "string", description: "URL ảnh đại diện sản phẩm." },
      {
        name: "response.item_info[].item_status",
        type: "int32",
        sample: "1",
        description: "Trạng thái sản phẩm trong Flash Sale. Trống nếu sản phẩm có biến thể: 0 = disable, 1 = enable, 2 = delete, 4 = system_rejected, 5 = manual_rejected.",
      },
      { name: "response.item_info[].original_price", type: "float", description: "Giá gốc sản phẩm. Trống nếu sản phẩm có biến thể." },
      { name: "response.item_info[].input_promotion_price", type: "float", description: "Giá khuyến mãi chưa bao gồm thuế. Trống nếu sản phẩm có biến thể." },
      { name: "response.item_info[].promotion_price_with_tax", type: "float", description: "Giá khuyến mãi đã bao gồm thuế. Có giá trị nếu sản phẩm không có biến thể." },
      { name: "response.item_info[].purchase_limit", type: "int64", description: "Giới hạn số lượng mua. 0 = không giới hạn. Trống nếu sản phẩm có biến thể." },
      { name: "response.item_info[].campaign_stock", type: "int64", description: "Tồn kho dành riêng cho Flash Sale. Có giá trị nếu sản phẩm không có biến thể." },
      { name: "response.item_info[].stock", type: "int64", description: "Tồn kho hiện hoạt. Có giá trị nếu sản phẩm không có biến thể." },
      { name: "response.item_info[].reject_reason", type: "string", description: "Lý do từ chối. Có giá trị khi item_status là 4 hoặc 5, và sản phẩm không có biến thể." },
      { name: "response.item_info[].unqualified_conditions", type: "object", description: "Điều kiện không đủ tiêu chuẩn. Trống nếu sản phẩm có biến thể." },
      { name: "response.item_info[].unqualified_conditions.unqualified_code", type: "int32", description: "Mã lý do không đủ tiêu chuẩn." },
      { name: "response.item_info[].unqualified_conditions.unqualified_msg", type: "string", description: "Mô tả lý do không đủ tiêu chuẩn." },
    ],
  },
  {
    id: "update-shop-flash-sale",
    module: "flash_sale",
    name: "v2.shop_flash_sale.update_shop_flash_sale",
    method: "POST",
    path: "/api/v2/shop_flash_sale/update_shop_flash_sale",
    description: "Chỉnh sửa trạng thái chương trình Flash Sale của shop (bật/tắt).",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/update_shop_flash_sale",
      },
    ],
    commonParams: [
      { name: "partner_id", type: "int", sample: "1", description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request." },
      { name: "timestamp", type: "timestamp", sample: "1610000000", description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút." },
      { name: "access_token", type: "string", sample: "c09222e3fc40ffb25fc947f738b1abf1", description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ." },
      { name: "shop_id", type: "int", sample: "600000", description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API." },
      { name: "sign", type: "string", sample: "e318d3e93271991...", description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256." },
    ],
    requestParams: [
      {
        name: "flash_sale_id",
        type: "int64",
        required: true,
        description: "ID của Flash Sale cần cập nhật.",
      },
      {
        name: "status",
        type: "int32",
        required: true,
        sample: "1",
        description: "Trạng thái muốn đặt cho Flash Sale. Không thể chỉnh sửa khi ở trạng thái system_rejected. Tắt Flash Sale sẽ tắt tất cả sản phẩm trong session đó. 1 = enable, 2 = disabled.",
      },
    ],
    responseParams: [
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "response", type: "object", description: "Kết quả cập nhật Flash Sale." },
      { name: "response.timeslot_id", type: "int64", description: "ID của time slot." },
      { name: "response.flash_sale_id", type: "int64", description: "ID của Flash Sale." },
      {
        name: "response.status",
        type: "int32",
        sample: "1",
        description: "Trạng thái hiện tại của Flash Sale: 0 = deleted, 1 = enabled, 2 = disabled, 3 = system_rejected (không thể chỉnh sửa khi ở trạng thái này).",
      },
    ],
  },
  {
    id: "update-shop-flash-sale-items",
    module: "flash_sale",
    name: "v2.shop_flash_sale.update_shop_flash_sale_items",
    method: "POST",
    path: "/api/v2/shop_flash_sale/update_shop_flash_sale_items",
    description: "Chỉnh sửa sản phẩm trong Flash Sale. Chỉ có thể chỉnh sửa các model đang ở trạng thái disabled hoặc enabled.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/update_shop_flash_sale_items",
      },
    ],
    commonParams: [
      { name: "partner_id", type: "int", sample: "1", description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request." },
      { name: "timestamp", type: "timestamp", sample: "1610000000", description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút." },
      { name: "access_token", type: "string", sample: "c09222e3fc40ffb25fc947f738b1abf1", description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ." },
      { name: "shop_id", type: "int", sample: "600000", description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API." },
      { name: "sign", type: "string", sample: "e318d3e93271991...", description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256." },
    ],
    requestParams: [
      { name: "flash_sale_id", type: "int64", required: true, description: "ID của Flash Sale cần cập nhật sản phẩm." },
      { name: "items", type: "object[]", required: true, description: "Danh sách sản phẩm cần cập nhật." },
      { name: "items[].item_id", type: "int64", required: true, description: "ID của sản phẩm." },
      {
        name: "items[].purchase_limit",
        type: "int32",
        required: false,
        sample: "0",
        description: "Giới hạn số lượng mua. min=0, 0 = không giới hạn. Không thể đặt nếu sản phẩm đang enabled hoặc có model đang enabled.",
      },
      {
        name: "items[].models",
        type: "object[]",
        required: false,
        description: "Danh sách biến thể. Bắt buộc nếu sản phẩm có biến thể, không dùng nếu sản phẩm không có biến thể.",
      },
      { name: "items[].models[].model_id", type: "int64", required: true, description: "ID biến thể. Bắt buộc nếu sản phẩm có biến thể." },
      {
        name: "items[].models[].status",
        type: "int32",
        required: true,
        sample: "1",
        description: "Trạng thái biến thể: 0 = disable, 1 = enable.",
      },
      {
        name: "items[].models[].input_promo_price",
        type: "float",
        required: false,
        description: "Giá khuyến mãi chưa bao gồm thuế. Không thể đặt khi model đang enabled (status=1). Nếu model đang disabled và muốn đặt giá, cần đặt status=1 cùng lúc.",
      },
      {
        name: "items[].models[].stock",
        type: "int32",
        required: false,
        sample: "1",
        description: "Tồn kho Flash Sale của biến thể. min=1. Không thể đặt khi model đang enabled (status=1). Nếu model đang disabled và muốn đặt, cần đặt status=1 cùng lúc.",
      },
      {
        name: "items[].item_status",
        type: "int32",
        required: false,
        sample: "1",
        description: "Trạng thái sản phẩm. Bắt buộc nếu sản phẩm không có biến thể, không dùng nếu có biến thể. 0 = disable, 1 = enable.",
      },
      {
        name: "items[].item_input_promo_price",
        type: "float",
        required: false,
        description: "Giá khuyến mãi sản phẩm (không có biến thể). Không dùng nếu có biến thể. Không thể đặt khi item_status=1. Nếu item_status=0 và muốn đặt giá, cần đặt item_status=1 cùng lúc.",
      },
      {
        name: "items[].item_stock",
        type: "int32",
        required: false,
        sample: "1",
        description: "Tồn kho Flash Sale của sản phẩm (không có biến thể). min=1. Không dùng nếu có biến thể. Không thể đặt khi item_status=1. Nếu item_status=0 và muốn đặt, cần đặt item_status=1 cùng lúc.",
      },
    ],
    responseParams: [
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "response", type: "object", description: "Kết quả cập nhật sản phẩm Flash Sale." },
      { name: "response.failed_items", type: "object[]", description: "Danh sách sản phẩm/biến thể cập nhật thất bại." },
      { name: "response.failed_items[].item_id", type: "int64", description: "ID của sản phẩm thất bại." },
      { name: "response.failed_items[].model_id", type: "int64", description: "ID biến thể thất bại. Trống nếu sản phẩm không có biến thể." },
      { name: "response.failed_items[].err_code", type: "int32", description: "Mã lỗi." },
      { name: "response.failed_items[].err_msg", type: "string", description: "Lý do không thể cập nhật model/sản phẩm." },
      { name: "response.failed_items[].unqualified_conditions", type: "object[]", description: "Chi tiết điều kiện không đạt tiêu chí (nếu có)." },
      { name: "response.failed_items[].unqualified_conditions[].unqualified_code", type: "int32", description: "Mã lý do không đủ tiêu chuẩn." },
      { name: "response.failed_items[].unqualified_conditions[].unqualified_msg", type: "string", description: "Mô tả lý do không đủ tiêu chuẩn." },
    ],
  },
  {
    id: "delete-shop-flash-sale",
    module: "flash_sale",
    name: "v2.shop_flash_sale.delete_shop_flash_sale",
    method: "POST",
    path: "/api/v2/shop_flash_sale/delete_shop_flash_sale",
    description: "Xoá chương trình Flash Sale của shop. Không thể xoá Flash Sale đang diễn ra (ongoing) hoặc đã kết thúc (expired).",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/delete_shop_flash_sale",
      },
    ],
    commonParams: [
      { name: "partner_id", type: "int", sample: "1", description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request." },
      { name: "timestamp", type: "timestamp", sample: "1610000000", description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút." },
      { name: "access_token", type: "string", sample: "c09222e3fc40ffb25fc947f738b1abf1", description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ." },
      { name: "shop_id", type: "int", sample: "600000", description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API." },
      { name: "sign", type: "string", sample: "e318d3e93271991...", description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256." },
    ],
    requestParams: [
      {
        name: "flash_sale_id",
        type: "int64",
        required: true,
        description: "ID của Flash Sale cần xoá. Không thể xoá Flash Sale đang diễn ra hoặc đã kết thúc.",
      },
    ],
    responseParams: [
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "response", type: "object", description: "Kết quả xoá Flash Sale." },
      { name: "response.timeslot_id", type: "int64", description: "ID của time slot." },
      { name: "response.flash_sale_id", type: "int64", description: "ID của Flash Sale đã xoá." },
      {
        name: "response.status",
        type: "int32",
        sample: "0",
        description: "Trạng thái Flash Sale sau khi xoá: 0 = deleted, 1 = enabled, 2 = disabled, 3 = system_rejected.",
      },
    ],
  },
  {
    id: "delete-shop-flash-sale-items",
    module: "flash_sale",
    name: "v2.shop_flash_sale.delete_shop_flash_sale_items",
    method: "POST",
    path: "/api/v2/shop_flash_sale/delete_shop_flash_sale_items",
    description: "Xoá sản phẩm khỏi chương trình Flash Sale của shop. Xoá một sản phẩm sẽ xoá tất cả các biến thể của sản phẩm đó.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/shop_flash_sale/delete_shop_flash_sale_items",
      },
    ],
    commonParams: [
      { name: "partner_id", type: "int", sample: "1", description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request." },
      { name: "timestamp", type: "timestamp", sample: "1610000000", description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút." },
      { name: "access_token", type: "string", sample: "c09222e3fc40ffb25fc947f738b1abf1", description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ." },
      { name: "shop_id", type: "int", sample: "600000", description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API." },
      { name: "sign", type: "string", sample: "e318d3e93271991...", description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256." },
    ],
    requestParams: [
      { name: "flash_sale_id", type: "int64", required: true, description: "ID của Flash Sale cần xoá sản phẩm." },
      { name: "item_ids", type: "int64[]", required: true, description: "Danh sách ID sản phẩm cần xoá. Xoá một sản phẩm sẽ xoá tất cả biến thể của sản phẩm đó." },
    ],
    responseParams: [
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "response", type: "object", description: "Kết quả xoá sản phẩm Flash Sale." },
      { name: "response.failed_items", type: "object[]", description: "Danh sách sản phẩm/biến thể xoá thất bại." },
      { name: "response.failed_items[].item_id", type: "int64", description: "ID của sản phẩm thất bại." },
      { name: "response.failed_items[].model_id", type: "int64", description: "ID biến thể thất bại. Trống nếu sản phẩm không có biến thể." },
      { name: "response.failed_items[].err_code", type: "int32", description: "Mã lỗi." },
      { name: "response.failed_items[].err_msg", type: "string", description: "Lý do không thể xoá model/sản phẩm." },
      { name: "response.failed_items[].unqualified_conditions", type: "object[]", description: "Chi tiết điều kiện không đạt tiêu chí (nếu có)." },
      { name: "response.failed_items[].unqualified_conditions[].unqualified_code", type: "int32", description: "Mã lý do không đủ tiêu chuẩn." },
      { name: "response.failed_items[].unqualified_conditions[].unqualified_msg", type: "string", description: "Mô tả lý do không đủ tiêu chuẩn." },
    ],
  },
  {
    id: "get-shop-performance",
    module: "account_health",
    name: "v2.account_health.get_shop_performance",
    method: "GET",
    path: "/api/v2/account_health/get_shop_performance",
    description: "Lấy dữ liệu hiệu suất của shop, bao gồm các chỉ số về fulfillment, listing, customer service và các metrics chi tiết.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/account_health/get_shop_performance",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [],
    responseParams: [
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "response", type: "object", description: "Dữ liệu hiệu suất shop." },
      { name: "response.overall_performance", type: "object", description: "Tổng quan hiệu suất shop." },
      {
        name: "response.overall_performance.rating",
        type: "int32",
        description: `Đánh giá tổng thể:
• Poor = 1
• Improvement/Needed = 2
• Good = 3
• Excellent = 4`
      },
      { name: "response.overall_performance.fulfillment_failed", type: "int32", description: "Số lượng metrics không đạt mục tiêu trong Fulfillment Performance." },
      { name: "response.overall_performance.listing_failed", type: "int32", description: "Số lượng metrics không đạt mục tiêu trong Listing Performance." },
      { name: "response.overall_performance.custom_service_failed", type: "int32", description: "Số lượng metrics không đạt mục tiêu trong Customer Service Performance." },
      { name: "response.metric_list", type: "object[]", description: "Danh sách các metrics chi tiết." },
      {
        name: "response.metric_list[].metric_type",
        type: "int32",
        description: `Loại metric:
• Fulfillment Performance = 1
• Listing Performance = 2
• Customer Service Performance = 3`
      },
      {
        name: "response.metric_list[].metric_id",
        type: "int64",
        description: `ID của metric. Nếu metric_id < 0 có nghĩa là đây không phải là metric thực, mà là một nhóm metrics.

Danh sách đầy đủ các metric IDs:
• Non-Responded Chats = -1
• Late Shipment Rate (All Channels) = 1
• Non-Fulfilment Rate (All Channels) = 3
• Preparation Time = 4
• Chat Response Rate = 11
• Pre-order Listing % = 12
• Days of Pre-order Listing Violation = 15
• Response Time = 21
• Shop Rating = 22
• No. of Non-Responded Chats = 23
• Fast Handover Rate = 25
• On-time Pickup Failure Rate = 27
• On-time Pickup Failure Rate Violation Value = 28
• Average Response Time = 29
• Cancellation Rate (All Channels) = 42
• Return-refund Rate (All Channels) = 43
• Severe Listing Violations = 52
• Other Listing Violations = 53
• Prohibited Listings = 54
• Counterfeit/IP infringement = 55
• Spam Listings = 56
• Late Shipment Rate (NDD) = 85
• Non-fulfilment Rate (NDD) = 88
• Cancellation Rate (NDD) = 91
• Return-refund Rate (NDD) = 92
• Customer Satisfaction = 95
• % SDD Listings = 96
• % NDD Listings = 97
• Fast Handover Rate - SLS = 2001
• Fast Handover Rate - FBS = 2002
• Fast Handover Rate - 3PF = 2003
• Poor Quality Products = 2011
• % HD Listings = 2030
• % HD Free Shipping Enabled = 2031
• Saturday Shipment = 2032
• Preparation Time PS = 2033`
      },
      { name: "response.metric_list[].parent_metric_id", type: "int64", description: "ID của parent metric." },
      { name: "response.metric_list[].metric_name", type: "string", description: "Tên mặc định của metric." },
      { name: "response.metric_list[].current_period", type: "float", description: "Hiệu suất của metric tại kỳ hiện tại." },
      { name: "response.metric_list[].last_period", type: "float", description: "Hiệu suất của metric tại kỳ trước." },
      {
        name: "response.metric_list[].unit",
        type: "int32",
        description: `Đơn vị của metric:
• Number = 1
• Percentage = 2
• Second = 3
• Day = 4
• Hour = 5`
      },
      { name: "response.metric_list[].target", type: "object", description: "Mục tiêu của metric." },
      { name: "response.metric_list[].target.value", type: "float", description: "Giá trị mục tiêu." },
      { name: "response.metric_list[].target.comparator", type: "string", description: "Toán tử so sánh mục tiêu: <, <=, >, >=, =." },
      { name: "response.metric_list[].exemption_end_date", type: "string", description: "(Chỉ dành cho whitelist TW sellers) Giá trị exemption_end_date sẽ không rỗng nếu TẤT CẢ các điều kiện được đáp ứng:\n- Shop nằm trong 'POL Shop Whitelist'\n- Trong 'Exemption Period'\n- metric_id là 12 (Pre-order Listing %) hoặc 15 (Days of Pre-order Listing Violation)" },
    ],
  },
  {
    id: "get-metric-source-detail",
    module: "account_health",
    name: "v2.account_health.get_metric_source_detail",
    method: "GET",
    path: "/api/v2/account_health/get_metric_source_detail",
    description: "Lấy chi tiết về Affected Orders / Relevant Listings / Relevant Violations của các metrics.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/account_health/get_metric_source_detail",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "metric_id",
        type: "int64",
        required: true,
        sample: "1",
        description: `ID của metric. Các giá trị được hỗ trợ:
• 1: Tỷ lệ Giao hàng Trễ (Tất cả Kênh)
• 3: Tỷ lệ Không hoàn thành Đơn (Tất cả Kênh)
• 4: Thời gian Chuẩn bị
• 12: % Listing Đặt trước
• 15: Số ngày Vi phạm Listing Đặt trước
• 25: Tỷ lệ Bàn giao Nhanh
• 28: Giá trị Vi phạm Tỷ lệ Lấy hàng Đúng giờ
• 42: Tỷ lệ Hủy đơn (Tất cả Kênh)
• 43: Tỷ lệ Hoàn-Trả (Tất cả Kênh)
• 52: Vi phạm Listing Nghiêm trọng
• 53: Vi phạm Listing Khác
• 85: Tỷ lệ Giao hàng Trễ (NDD)
• 88: Tỷ lệ Không hoàn thành (NDD)
• 91: Tỷ lệ Hủy đơn (NDD)
• 92: Tỷ lệ Hoàn-Trả (NDD)
• 96: % SDD Listings
• 97: % NDD Listings
• 2001: Tỷ lệ Bàn giao Nhanh - SLS
• 2002: Tỷ lệ Bàn giao Nhanh - FBS
• 2003: Tỷ lệ Bàn giao Nhanh - 3PF
• 2030: % HD Listings
• 2031: % HD Freeship được Bật
• 2032: Giao hàng thứ Bảy
• 2033: Thời gian Chuẩn bị PS`
      },
      {
        name: "page_no",
        type: "int32",
        required: false,
        sample: "1",
        description: "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Bắt đầu từ 1. Nếu dữ liệu nhiều hơn một trang, page_no có thể là giá trị để bắt đầu lần gọi tiếp theo. Mặc định là 1."
      },
      {
        name: "page_size",
        type: "int32",
        required: false,
        sample: "10",
        description: "Mỗi tập kết quả được trả về dưới dạng một trang entries. Sử dụng page_size để kiểm soát số lượng entries tối đa cần lấy mỗi trang (mỗi lần gọi), và page_no để bắt đầu lần gọi tiếp theo. Giá trị này dùng để chỉ định số lượng entries tối đa trả về trong một trang dữ liệu. Giới hạn page_size từ 1 đến 100. Mặc định là 10."
      },
    ],
    responseParams: [
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "response", type: "object", description: "Chi tiết về affected orders/listings." },
      { name: "response.metric_id", type: "int64", sample: "1", description: "ID của metric." },
      { name: "response.nfr_order_list", type: "object[]", description: "Đơn hàng Bị ảnh hưởng cho Tỷ lệ Không hoàn thành. Hỗ trợ metric_id: 3 (Non-Fulfilment Rate Tất cả Kênh), 88 (Non-fulfilment Rate NDD)." },
      { name: "response.nfr_order_list[].order_sn", type: "string", description: "Mã đơn hàng." },
      {
        name: "response.nfr_order_list[].non_fulfillment_type",
        type: "int32",
        description: `Loại không hoàn thành. Giá trị:
• 1: Hủy bởi Hệ thống
• 2: Hủy bởi Người bán
• 3: Hoàn trả`
      },
      {
        name: "response.nfr_order_list[].detailed_reason",
        type: "int32",
        description: `Lý do. Giá trị:
• 1001: Hoàn trả
• 1002: Hủy do Chia kiện
• 1003: Lấy hàng Mile Đầu thất bại
• 1004: Gộp đơn hàng
• 10005: Hết hàng
• 10006: Khu vực không giao được
• 10007: Không hỗ trợ COD
• 10008: Yêu cầu vận chuyển bị hủy
• 10009: Lấy hàng thất bại
• 10010: Vận chuyển chưa sẵn sàng
• 10011: Người bán không hoạt động
• 10012: Người bán không giao hàng
• 10013: Đơn không đến kho
• 10014: Người bán yêu cầu hủy
• 10015: Không nhận được hàng
• 10016: Sai sản phẩm
• 10017: Sản phẩm bị hư
• 10018: Sản phẩm không đầy đủ
• 10019: Hàng giả
• 10020: Hỏng chức năng
• 10021: Hoàn trả`
      },
      { name: "response.cancellation_order_list", type: "object[]", description: "Đơn hàng Bị ảnh hưởng cho Tỷ lệ Hủy đơn. Hỗ trợ metric_id: 42 (Cancellation Rate Tất cả Kênh), 91 (Cancellation Rate NDD)." },
      { name: "response.cancellation_order_list[].order_sn", type: "string", description: "Mã đơn hàng." },
      {
        name: "response.cancellation_order_list[].cancellation_type",
        type: "int32",
        description: `Loại hủy đơn. Giá trị:
• 1: Hủy bởi Hệ thống
• 2: Hủy bởi Người bán`
      },
      {
        name: "response.cancellation_order_list[].detailed_reason",
        type: "int32",
        description: `Reason. Applicable values:
• 1001: Return Refund
• 1002: Parcel Split Cancellation
• 1003: First Mile Pick up fail
• 1004: Order inclusion
• 10005: Out of Stock
• 10006: Undeliverable area
• 10007: Cannot support COD
• 10008: Logistics request cancelled
• 10009: Logistics pickup failed
• 10010: Logistics not ready
• 10011: Inactive seller
• 10012: Seller did not ship order
• 10013: Order did not reach warehouse
• 10014: Seller asked to cancel
• 10015: Non-receipt
• 10016: Wrong item
• 10017: Damaged item
• 10018: Incomplete product
• 10019: Fake item
• 10020: Functional Damage
• 10021: Return Refund`
      },
      { name: "response.return_refund_order_list", type: "object[]", description: "Đơn hàng Bị ảnh hưởng cho Tỷ lệ Hoàn-Trả. Hỗ trợ metric_id: 43 (Return-refund Rate Tất cả Kênh), 92 (Return-refund Rate NDD)." },
      { name: "response.return_refund_order_list[].order_sn", type: "string", description: "Mã đơn hàng." },
      {
        name: "response.return_refund_order_list[].detailed_reason",
        type: "int32",
        description: `Reason. Applicable values:
• 1001: Return Refund
• 1002: Parcel Split Cancellation
• 1003: First Mile Pick up fail
• 1004: Order inclusion
• 10005: Out of Stock
• 10006: Undeliverable area
• 10007: Cannot support COD
• 10008: Logistics request cancelled
• 10009: Logistics pickup failed
• 10010: Logistics not ready
• 10011: Inactive seller
• 10012: Seller did not ship order
• 10013: Order did not reach warehouse
• 10014: Seller asked to cancel
• 10015: Non-receipt
• 10016: Wrong item
• 10017: Damaged item
• 10018: Incomplete product
• 10019: Fake item
• 10020: Functional Damage
• 10021: Return Refund`
      },
      { name: "response.lsr_order_list", type: "object[]", description: "Đơn hàng Bị ảnh hưởng cho Tỷ lệ Giao hàng Trễ. Hỗ trợ metric_id: 1 (Late Shipment Rate Tất cả Kênh), 85 (Late Shipment Rate NDD)." },
      { name: "response.lsr_order_list[].order_sn", type: "string", description: "Mã đơn hàng." },
      { name: "response.lsr_order_list[].shipping_deadline", type: "timestamp", description: "Hạn giao hàng." },
      { name: "response.lsr_order_list[].actual_shipping_time", type: "timestamp", description: "Thời gian người bán sắp xếp giao hàng." },
      { name: "response.lsr_order_list[].late_by_days", type: "int64", description: "Số ngày trễ." },
      { name: "response.lsr_order_list[].actual_pick_up_time", type: "timestamp", description: "Thời gian shipper thực tế lấy hàng." },
      { name: "response.lsr_order_list[].shipping_channel", type: "string", description: "Đơn vị vận chuyển." },
      {
        name: "response.lsr_order_list[].first_mile_type",
        type: "string",
        description: `Loại giao hàng Mile Đầu. Giá trị:
• Pickup (Lấy hàng)
• Drop off (Gửi hàng)`
      },
      { name: "response.lsr_order_list[].diagnosis_scenario", type: "string[]", description: "Chẩn đoán vấn đề." },
      { name: "response.fhr_order_list", type: "object[]", description: "Đơn hàng Bị ảnh hưởng cho Tỷ lệ Bàn giao Nhanh. Hỗ trợ metric_id: 25 (Fast Handover Rate), 2001 (Fast Handover Rate - SLS), 2002 (Fast Handover Rate - FBS), 2003 (Fast Handover Rate - 3PF)." },
      { name: "response.fhr_order_list[].order_sn", type: "string", description: "Mã đơn hàng." },
      { name: "response.fhr_order_list[].parcel_id", type: "int64", description: "ID Kiện hàng." },
      { name: "response.fhr_order_list[].parcel_display_id", type: "string", description: "ID Kiện hàng hiển thị." },
      { name: "response.fhr_order_list[].confirm_time", type: "timestamp", description: "Ngày xác nhận." },
      { name: "response.fhr_order_list[].handover_deadline", type: "timestamp", description: "Hạn bàn giao." },
      { name: "response.fhr_order_list[].fast_handover_due_date", type: "timestamp", description: "Ngày đến hạn Bàn giao Nhanh." },
      { name: "response.fhr_order_list[].arrange_pick_up_time", type: "timestamp", description: "Thời gian người bán sắp xếp lấy hàng." },
      { name: "response.fhr_order_list[].handover_time", type: "timestamp", description: "Thời gian gửi/lấy kiện hàng." },
      { name: "response.fhr_order_list[].shipping_channel", type: "string", description: "Đơn vị vận chuyển." },
      {
        name: "response.fhr_order_list[].first_mile_type",
        type: "string",
        description: `First mile shipping type. Applicable values:
• Pickup
• Drop off`
      },
      { name: "response.fhr_order_list[].first_mile_tracking_no", type: "string", description: "Mã Tracking Mile Đầu." },
      { name: "response.fhr_order_list[].diagnosis_scenario", type: "string[]", description: "Chẩn đoán vấn đề." },
      { name: "response.opfr_day_detail_data_list", type: "object[]", description: "Vi phạm Liên quan cho Giá trị Vi phạm OPFR. Hỗ trợ metric_id: 28 (On-time Pickup Failure Rate Violation Value)." },
      { name: "response.opfr_day_detail_data_list[].date", type: "string", sample: "19/10/2024", description: "Ngày." },
      { name: "response.opfr_day_detail_data_list[].scheduled_pickup_num", type: "int32", sample: "48", description: "Số lần lấy hàng đã lên lịch." },
      { name: "response.opfr_day_detail_data_list[].failed_pickup_num", type: "int32", sample: "11", description: "Số lần lấy hàng thất bại." },
      { name: "response.opfr_day_detail_data_list[].opfr", type: "int32", description: "OPFR." },
      { name: "response.opfr_day_detail_data_list[].target", type: "string", sample: "49.90%", description: "Mục tiêu." },
      { name: "response.violation_listing_list", type: "object[]", description: "Listings Liên quan cho Vi phạm Listing Nghiêm trọng và Vi phạm Listing Khác. Hỗ trợ metric_id: 52 (Severe Listing Violations), 53 (Other Listing Violations)." },
      { name: "response.violation_listing_list[].item_id", type: "int64", description: "ID Sản phẩm." },
      {
        name: "response.violation_listing_list[].detailed_reason",
        type: "int32",
        description: `Lý do. Giá trị:
• 1: Cấm
• 2: Hàng giả
• 3: Spam
• 4: Hình ảnh Không phù hợp
• 5: Thông tin Không đủ
• 6: Cải thiện Listing Mall
• 7: Cải thiện Listing Khác
• 8: Sản phẩm PQR`
      },
      { name: "response.violation_listing_list[].update_time", type: "timestamp", description: "Cập nhật lúc." },
      { name: "response.pre_order_listing_violation_data_list", type: "object[]", description: "Listings Liên quan cho Số ngày Vi phạm Listing Đặt trước.\n\nHỗ trợ metric_id:\n15: Days of Pre-order Listing Violation" },
      { name: "response.pre_order_listing_violation_data_list[].date", type: "string", sample: "03/11/2024", description: "Ngày." },
      { name: "response.pre_order_listing_violation_data_list[].live_listing_count", type: "int64", sample: "100", description: "Số lượng Live Listings." },
      { name: "response.pre_order_listing_violation_data_list[].pre_order_listing_count", type: "int32", sample: "10", description: "Số lượng listing đặt trước." },
      { name: "response.pre_order_listing_violation_data_list[].pre_order_listing_rate", type: "int32", description: "% Listing Đặt trước." },
      { name: "response.pre_order_listing_violation_data_list[].target", type: "string", sample: "13.00%", description: "Mục tiêu." },
      { name: "response.pre_order_listing_list", type: "object[]", description: "Listings Liên quan cho Listing Đặt trước.\n\nHỗ trợ metric_id:\n12: Pre-order Listing %" },
      { name: "response.pre_order_listing_list[].item_id", type: "int64", description: "ID Sản phẩm." },
      {
        name: "response.pre_order_listing_list[].current_pre_order_status",
        type: "int32",
        description: `Trạng thái Đặt trước Hiện tại. Giá trị:
• 1: Có
• 2: Không`
      },
      { name: "response.sdd_listing_list", type: "object[]", description: "Listings Liên quan cho % SDD Listings. Hỗ trợ metric_id: 96 (% SDD Listings)." },
      { name: "response.sdd_listing_list[].item_id", type: "int64", description: "ID Sản phẩm." },
      {
        name: "response.sdd_listing_list[].current_sdd_status",
        type: "int32",
        description: `Trạng thái SDD Hiện tại. Giá trị:
• 1: Có
• 0: Không`
      },
      { name: "response.ndd_listing_list", type: "object[]", description: "Listings Liên quan cho % NDD Listings. Hỗ trợ metric_id: 97 (% NDD Listings)." },
      { name: "response.ndd_listing_list[].item_id", type: "int64", description: "ID Sản phẩm." },
      {
        name: "response.ndd_listing_list[].current_ndd_status",
        type: "int32",
        description: `Trạng thái NDD Hiện tại. Giá trị:
• 1: Có
• 0: Không`
      },
      { name: "response.apt_order_list", type: "object[]", description: "Kiện hàng Bị ảnh hưởng cho Thời gian Chuẩn bị. Hỗ trợ metric_id: 4 (Preparation Time)." },
      { name: "response.apt_order_list[].order_sn", type: "string", description: "Mã đơn hàng." },
      { name: "response.apt_order_list[].order_create_time", type: "timestamp", description: "Thời gian Thanh toán Đơn." },
      { name: "response.apt_order_list[].arrange_pick_up_time", type: "timestamp", description: "Thời gian người bán sắp xếp lấy hàng." },
      { name: "response.apt_order_list[].actual_pick_up_time", type: "timestamp", description: "Thời gian shipper thực tế lấy hàng." },
      { name: "response.apt_order_list[].preparation_days", type: "float", description: "Số ngày Chuẩn bị." },
      { name: "response.apt_order_list[].shipping_channel", type: "string", description: "Đơn vị vận chuyển." },
      {
        name: "response.apt_order_list[].first_mile_type",
        type: "string",
        description: `First mile shipping type. Applicable values:
• Pickup
• Drop off`
      },
      { name: "response.apt_order_list[].first_mile_tracking_no", type: "string", description: "Mã Tracking Mile Đầu." },
      { name: "response.hd_listing_list", type: "object", description: "Listings Liên quan cho % HD Listings và % HD Free Shipping Enabled. Hỗ trợ metric_id: 2030 (% HD Listings), 2031 (% HD Free Shipping Enabled)." },
      { name: "response.hd_listing_list.item_id", type: "int64", description: "ID Sản phẩm." },
      {
        name: "response.hd_listing_list.current_status",
        type: "int32",
        description: `Đối với 2030: % HD Listings, trỏ đến Trạng thái HD Hiện tại. Đối với 2031: % HD Free Shipping Enabled, trỏ đến Trạng thái Freeship được Bật.

Giá trị:
• 1: Có
• 2: Không`
      },
      { name: "response.saturday_shipment_list", type: "object[]", description: "Kiện hàng Bị ảnh hưởng cho Giao hàng thứ Bảy. Hỗ trợ metric_id: 2032 (Saturday Shipment)." },
      { name: "response.saturday_shipment_list[].order_sn", type: "string", description: "Mã đơn hàng." },
      { name: "response.saturday_shipment_list[].order_create_time", type: "timestamp", description: "Thời gian Thanh toán Đơn." },
      { name: "response.saturday_shipment_list[].arrange_pick_up_time", type: "timestamp", description: "Thời gian người bán sắp xếp lấy hàng." },
      { name: "response.saturday_shipment_list[].actual_pick_up_time", type: "timestamp", description: "Thời gian shipper thực tế lấy hàng." },
      { name: "response.saturday_shipment_list[].preparation_days", type: "float", description: "Số ngày Chuẩn bị." },
      { name: "response.saturday_shipment_list[].shipping_channel", type: "string", description: "Đơn vị vận chuyển." },
      {
        name: "response.saturday_shipment_list[].first_mile_type",
        type: "string",
        description: `First mile shipping type. Applicable values:
• Pickup
• Drop off`
      },
      { name: "response.saturday_shipment_list[].first_mile_tracking_no", type: "string", description: "Mã Tracking Mile Đầu." },
      { name: "response.total_count", type: "int32", description: "Tổng số Đơn hàng Bị ảnh hưởng hoặc Listings Liên quan." },
    ],
  },
  {
    id: "get-penalty-point-history",
    module: "account_health",
    name: "v2.account_health.get_penalty_point_history",
    method: "GET",
    path: "/api/v2/account_health/get_penalty_point_history",
    description: "Lấy lịch sử điểm phạt được tạo trong quý hiện tại.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/account_health/get_penalty_point_history",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "page_no",
        type: "int32",
        required: false,
        sample: "1",
        description: "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Bắt đầu từ 1. Nếu dữ liệu nhiều hơn một trang, page_no có thể là giá trị để bắt đầu lần gọi tiếp theo. Mặc định là 1."
      },
      {
        name: "page_size",
        type: "int32",
        required: false,
        sample: "10",
        description: "Mỗi tập kết quả được trả về dưới dạng một trang entries. Sử dụng page_size để kiểm soát số lượng entries tối đa cần lấy mỗi trang (mỗi lần gọi), và page_no để bắt đầu lần gọi tiếp theo. Giá trị này dùng để chỉ định số lượng entries tối đa trả về trong một trang dữ liệu. Giới hạn page_size từ 1 đến 100. Mặc định là 10."
      },
      {
        name: "violation_type",
        type: "int64",
        required: false,
        sample: "5",
        description: `Loại vi phạm. Giá trị:
• 5: Tỷ lệ Giao hàng Trễ Cao
• 6: Tỷ lệ Không hoàn thành Cao
• 7: Số lượng đơn không hoàn thành Cao
• 8: Số lượng đơn giao trễ Cao
• 9: Listing Cấm
• 10: Hàng giả / Vi phạm Sở hữu Trí tuệ
• 11: Spam
• 12: Sao chép/Đánh cắp hình ảnh
• 13: Đăng lại listing đã xóa không thay đổi
• 14: Mua hàng giả từ Mall
• 15: Hàng giả bị Shopee phát hiện
• 16: Phần trăm listing đặt trước Cao
• 17: Xác nhận Lừa đảo (tổng)
• 18: Xác nhận Lừa đảo mỗi tuần (Tất cả chỉ với voucher)
• 19: Địa chỉ hoàn trả Giả
• 20: Gian lận/lạm dụng Giao hàng
• 21: Số lượng Chat không trả lời Cao
• 22: Trả lời chat Thô lỗ
• 23: Yêu cầu người mua hủy đơn
• 24: Trả lời đánh giá của người mua Thô lỗ
• 25: Vi phạm chính sách Hoàn trả/Hoàn tiền
• 101: Lý do Tier
• 3026: Lạm dụng Sở hữu Trí tuệ của Shopee
• 3028: Vi phạm Quy định Tên Shop
• 3030: Giao dịch trực tiếp ngoài nền tảng Shopee
• 3032: Giao kiện hàng rỗng / không đầy đủ
• 3034: Vi phạm Nghiêm trọng trên Shopee Feed
• 3036: Vi phạm Nghiêm trọng trên Shopee LIVE
• 3038: Lạm dụng Tag Nhà cung cấp Địa phương
• 3040: Sử dụng tag shop gây hiểu lầm trong hình listing
• 3042: Test Hàng giả / Vi phạm Sở hữu Trí tuệ
• 3044: Tái phạm - Vi phạm Sở hữu Trí tuệ và listing Hàng giả
• 3046: Vi phạm Chính sách Bán Động vật Sống
• 3048: Spam Chat
• 3050: Tỷ lệ Hoàn trả Quốc tế Cao
• 3052: Vi phạm Quyền riêng tư trong trả lời đánh giá của người mua
• 3054: Order Brushing
• 3056: Hình ảnh khiêu dâm
• 3058: Danh mục Sản phẩm Không chính xác
• 3060: Tỷ lệ Không hoàn thành Cực cao
• 3062: Phạt Thanh toán Hóa đơn Quá hạn AMS
• 3064: Listing liên quan đến Chính phủ
• 3066: Listing quà tặng không hợp lệ
• 3068: Tỷ lệ không hoàn thành Cao (Đơn Giao Ngày mai)
• 3070: Tỷ lệ Giao hàng Trễ Cao (Đơn Giao Ngày mai)
• 3072: Giá trị Vi phạm OPFR
• 3074: Giao dịch trực tiếp ngoài Shopee qua chat
• 3090: Listing Cấm - Vi phạm Cực độ
• 3091: Listing Cấm - Vi phạm Cao
• 3092: Listing Cấm - Vi phạm Trung bình
• 3093: Listing Cấm - Vi phạm Thấp
• 3094: Listing Hàng giả - Vi phạm Cực độ
• 3095: Listing Hàng giả - Vi phạm Cao
• 3096: Listing Hàng giả - Vi phạm Trung bình
• 3097: Listing Hàng giả - Vi phạm Thấp
• 3098: Listing Spam - Vi phạm Cực độ
• 3099: Listing Spam - Vi phạm Cao
• 3100: Listing Spam - Vi phạm Trung bình
• 3101: Listing Spam - Vi phạm Thấp
• 3145: Tỷ lệ Hoàn trả/Hoàn tiền (Kênh Không tích hợp)
• 4130: Chất lượng Sản phẩm Kém`
      },
    ],
    responseParams: [
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "response", type: "object", description: "Dữ liệu lịch sử điểm phạt." },
      { name: "response.penalty_point_list", type: "object[]", description: "Danh sách điểm phạt được tạo trong quý hiện tại." },
      { name: "response.penalty_point_list[].issue_time", type: "timestamp", sample: "1728552398", description: "Thời gian điểm phạt được tạo." },
      { name: "response.penalty_point_list[].latest_point_num", type: "int32", sample: "0", description: "Điểm phạt mới nhất được tạo cho bản ghi điểm phạt hiện tại. Nếu người bán kháng cáo cho bản ghi điểm phạt này và kháng cáo được chấp nhận và Shopee điều chỉnh điểm phạt, thì original_point_num trả về điểm phạt trước khi điều chỉnh, và latest_point_num trả về điểm phạt sau khi điều chỉnh." },
      { name: "response.penalty_point_list[].original_point_num", type: "int32", sample: "1", description: "Điểm phạt ban đầu được tạo cho bản ghi điểm phạt hiện tại. Nếu người bán kháng cáo cho bản ghi điểm phạt này và kháng cáo được chấp nhận và Shopee điều chỉnh điểm phạt, thì original_point_num trả về điểm phạt trước khi điều chỉnh, và latest_point_num trả về điểm phạt sau khi điều chỉnh." },
      { name: "response.penalty_point_list[].reference_id", type: "int64", sample: "764539404640322244", description: "ID tham chiếu cho bản ghi điểm phạt này." },
      {
        name: "response.penalty_point_list[].violation_type",
        type: "int32",
        sample: "5",
        description: `Loại vi phạm. Giá trị:
• 5: Tỷ lệ Giao hàng Trễ Cao
• 6: Tỷ lệ Không hoàn thành Cao
• 7: Số lượng đơn không hoàn thành Cao
• 8: Số lượng đơn giao trễ Cao
• 9: Listing Cấm
• 10: Hàng giả / Vi phạm Sở hữu Trí tuệ
• 11: Spam
• 12: Sao chép/Đánh cắp hình ảnh
• 13: Đăng lại listing đã xóa không thay đổi
• 14: Mua hàng giả từ Mall
• 15: Hàng giả bị Shopee phát hiện
• 16: Phần trăm listing đặt trước Cao
• 17: Xác nhận Lừa đảo (tổng)
• 18: Xác nhận Lừa đảo mỗi tuần (Tất cả chỉ với voucher)
• 19: Địa chỉ hoàn trả Giả
• 20: Gian lận/lạm dụng Giao hàng
• 21: Số lượng Chat không trả lời Cao
• 22: Trả lời chat Thô lỗ
• 23: Yêu cầu người mua hủy đơn
• 24: Trả lời đánh giá của người mua Thô lỗ
• 25: Vi phạm chính sách Hoàn trả/Hoàn tiền
• 101: Lý do Tier
• 3026: Lạm dụng Sở hữu Trí tuệ của Shopee
• 3028: Vi phạm Quy định Tên Shop
• 3030: Giao dịch trực tiếp ngoài nền tảng Shopee
• 3032: Giao kiện hàng rỗng / không đầy đủ
• 3034: Vi phạm Nghiêm trọng trên Shopee Feed
• 3036: Vi phạm Nghiêm trọng trên Shopee LIVE
• 3038: Lạm dụng Tag Nhà cung cấp Địa phương
• 3040: Sử dụng tag shop gây hiểu lầm trong hình listing
• 3042: Test Hàng giả / Vi phạm Sở hữu Trí tuệ
• 3044: Tái phạm - Vi phạm Sở hữu Trí tuệ và listing Hàng giả
• 3046: Vi phạm Chính sách Bán Động vật Sống
• 3048: Spam Chat
• 3050: Tỷ lệ Hoàn trả Quốc tế Cao
• 3052: Vi phạm Quyền riêng tư trong trả lời đánh giá của người mua
• 3054: Order Brushing
• 3056: Hình ảnh khiêu dâm
• 3058: Danh mục Sản phẩm Không chính xác
• 3060: Tỷ lệ Không hoàn thành Cực cao
• 3062: Phạt Thanh toán Hóa đơn Quá hạn AMS
• 3064: Listing liên quan đến Chính phủ
• 3066: Listing quà tặng không hợp lệ
• 3068: Tỷ lệ không hoàn thành Cao (Đơn Giao Ngày mai)
• 3070: Tỷ lệ Giao hàng Trễ Cao (Đơn Giao Ngày mai)
• 3072: Giá trị Vi phạm OPFR
• 3074: Giao dịch trực tiếp ngoài Shopee qua chat
• 3090: Listing Cấm - Vi phạm Cực độ
• 3091: Listing Cấm - Vi phạm Cao
• 3092: Listing Cấm - Vi phạm Trung bình
• 3093: Listing Cấm - Vi phạm Thấp
• 3094: Listing Hàng giả - Vi phạm Cực độ
• 3095: Listing Hàng giả - Vi phạm Cao
• 3096: Listing Hàng giả - Vi phạm Trung bình
• 3097: Listing Hàng giả - Vi phạm Thấp
• 3098: Listing Spam - Vi phạm Cực độ
• 3099: Listing Spam - Vi phạm Cao
• 3100: Listing Spam - Vi phạm Trung bình
• 3101: Listing Spam - Vi phạm Thấp
• 3145: Tỷ lệ Hoàn trả/Hoàn tiền (Kênh Không tích hợp)
• 4130: Chất lượng Sản phẩm Kém`
      },
      { name: "response.total_count", type: "int32", sample: "8", description: "Tổng số bản ghi điểm phạt." },
    ],
  },
  {
    id: "get-punishment-history",
    module: "account_health",
    name: "v2.account_health.get_punishment_history",
    method: "GET",
    path: "/api/v2/account_health/get_punishment_history",
    description: "Lấy các bản ghi hình phạt (punishment) được tạo trong quý hiện tại.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/account_health/get_punishment_history",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e932719916a9f9ebb57e2011961bd47abfa54a36e040d050d893159 6e2",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "page_no",
        type: "int32",
        required: false,
        sample: "1",
        description: "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Bắt đầu từ 1. Nếu dữ liệu nhiều hơn một trang, page_no có thể là giá trị để bắt đầu lần gọi tiếp theo. Mặc định là 1.",
      },
      {
        name: "page_size",
        type: "int32",
        required: false,
        sample: "10",
        description: "Mỗi tập kết quả được trả về dưới dạng một trang entries. Sử dụng page_size để kiểm soát số lượng entries tối đa cần lấy mỗi trang (mỗi lần gọi), và page_no để bắt đầu lần gọi tiếp theo. Giá trị này dùng để chỉ định số lượng entries tối đa trả về trong một trang dữ liệu. Giới hạn page_size từ 1 đến 100. Mặc định là 10.",
      },
      {
        name: "punishment_status",
        type: "int32",
        required: true,
        sample: "1",
        description: `Trạng thái của hình phạt. Giá trị:
• 1: Ongoing (Đang diễn ra)
• 2: Ended (Đã kết thúc)`,
      },
    ],
    responseParams: [
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "response", type: "object", description: "Dữ liệu lịch sử hình phạt." },
      { name: "response.punishment_list", type: "object[]", description: "Các bản ghi hình phạt được tạo trong quý hiện tại." },
      { name: "response.punishment_list[].issue_time", type: "timestamp", description: "Thời gian hình phạt được tạo." },
      { name: "response.punishment_list[].start_time", type: "timestamp", description: "Thời gian bắt đầu của bản ghi hình phạt này." },
      { name: "response.punishment_list[].end_time", type: "timestamp", description: "Thời gian kết thúc của bản ghi hình phạt này." },
      {
        name: "response.punishment_list[].punishment_type",
        type: "int32",
        description: `Loại hình phạt của bản ghi này. Giá trị:
• 103: Listing không hiển thị trong duyệt danh mục
• 104: Listing không hiển thị trong tìm kiếm
• 105: Không thể tạo listing mới
• 106: Không thể chỉnh sửa listing
• 107: Không thể tham gia chiến dịch marketing
• 108: Không có trợ giá vận chuyển
• 109: Tài khoản bị đình chỉ
• 600: Listing không hiển thị trong tìm kiếm
• 601: Shop listing ẩn khỏi đề xuất
• 602: Listing không hiển thị trong duyệt danh mục
• 1100: Listing Limit is reduced
• 1110: Listing Limit is reduced
• 1111: Listing Limit is reduced
• 1112: Listing Limit is reduced
• 2008: Order Limit`,
      },
      {
        name: "response.punishment_list[].reason",
        type: "int32",
        description: `Lý do của bản ghi hình phạt này. Giá trị:
• 1: Tier 1
• 2: Tier 2
• 3: Tier 3
• 4: Tier 4
• 5: Tier 5
• 1100: Listing Limit Tier 1
• 1110: Listing Limit Tier 2
• 1111: Listing Limit PDL`,
      },
      { name: "response.punishment_list[].reference_id", type: "int64", description: "ID tham chiếu cho bản ghi hình phạt này." },
      {
        name: "response.punishment_list[].listing_limit",
        type: "int32",
        description: `Trả về giá trị cụ thể của listing limit khi punishment_type là:
• 1100: Listing Limit is reduced
• 1110: Listing Limit is reduced
• 1111: Listing Limit is reduced
• 1112: Listing Limit is reduced`,
      },
      {
        name: "response.punishment_list[].order_limit",
        type: "string",
        description: `Trả về phần trăm cụ thể của order limit khi punishment_type là:
• 2008: Order Limit

Daily Order Limit = X % * L28D ADO (Average Daily Order of this Shop in Past 28 Days)`,
      },
      { name: "response.total_count", type: "int32", description: "Tổng số bản ghi hình phạt." },
    ],
  },
  {
    id: "get-listings-with-issues",
    module: "account_health",
    name: "v2.account_health.get_listings_with_issues",
    method: "GET",
    path: "/api/v2/account_health/get_listings_with_issues",
    description: "Lấy danh sách các Listing có vấn đề (Problematic Listings) để cải thiện listing nhằm tránh bị tính điểm phạt.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/account_health/get_listings_with_issues",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "page_no",
        type: "int32",
        required: false,
        sample: "1",
        description: "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Bắt đầu từ 1. Nếu dữ liệu nhiều hơn một trang, page_no có thể là giá trị để bắt đầu lần gọi tiếp theo. Mặc định là 1.",
      },
      {
        name: "page_size",
        type: "int32",
        required: false,
        sample: "10",
        description: "Mỗi tập kết quả được trả về dưới dạng một trang entries. Sử dụng page_size để kiểm soát số lượng entries tối đa cần lấy mỗi trang (mỗi lần gọi), và page_no để bắt đầu lần gọi tiếp theo. Giá trị này dùng để chỉ định số lượng entries tối đa trả về trong một trang dữ liệu. Giới hạn page_size từ 1 đến 100. Mặc định là 10.",
      },
    ],
    responseParams: [
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "response", type: "object", description: "Dữ liệu listing có vấn đề." },
      { name: "response.listing_list", type: "object[]", description: "Danh sách listing có vấn đề." },
      { name: "response.listing_list[].item_id", type: "int64", sample: "100963774", description: "ID của item." },
      {
        name: "response.listing_list[].reason",
        type: "int32",
        sample: "1",
        description: `Lý do của item này. Giá trị:
• 1: Prohibited (Bị cấm)
• 2: Counterfeit (Hàng giả)
• 3: Spam
• 4: Inappropriate Image (Hình ảnh không phù hợp)
• 5: Insufficient Info (Thông tin không đầy đủ)
• 6: Mall Listing Improvement (Cải thiện Listing Mall)
• 7: Other Listing Improvement (Cải thiện Listing khác)`,
      },
      { name: "response.total_count", type: "int32", sample: "7", description: "Tổng số listing có vấn đề." },
    ],
  },
  {
    id: "get-late-orders",
    module: "account_health",
    name: "v2.account_health.get_late_orders",
    method: "GET",
    path: "/api/v2/account_health/get_late_orders",
    description: "Lấy danh sách các đơn hàng giao trễ (Late Orders) để xử lý kịp thời nhằm tránh bị hủy đơn và tính điểm phạt.",
    environments: [
      {
        name: "URL",
        url: "https://partner.shopeemobile.com/api/v2/account_health/get_late_orders",
      },
    ],
    commonParams: [
      {
        name: "partner_id",
        type: "int",
        sample: "1",
        description: "ID đối tác, được cấp khi đăng ký thành công. Bắt buộc cho mỗi request.",
      },
      {
        name: "timestamp",
        type: "timestamp",
        sample: "1610000000",
        description: "Thời gian gửi request (Unix timestamp). Bắt buộc. Hết hạn sau 5 phút.",
      },
      {
        name: "access_token",
        type: "string",
        sample: "c09222e3fc40ffb25fc947f738b1abf1",
        description: "Token truy cập API, dùng để xác định quyền truy cập. Có thể dùng nhiều lần, hết hạn sau 4 giờ.",
      },
      {
        name: "shop_id",
        type: "int",
        sample: "600000",
        description: "ID định danh duy nhất của shop trên Shopee. Bắt buộc cho hầu hết các API.",
      },
      {
        name: "sign",
        type: "string",
        sample: "e318d3e93271991...",
        description: "Chữ ký được tạo từ partner_id, api path, timestamp, access_token, shop_id và partner_key bằng thuật toán HMAC-SHA256.",
      },
    ],
    requestParams: [
      {
        name: "page_no",
        type: "int32",
        required: false,
        sample: "1",
        description: "Chỉ định số trang dữ liệu cần trả về trong lần gọi hiện tại. Bắt đầu từ 1. Nếu dữ liệu nhiều hơn một trang, page_no có thể là giá trị để bắt đầu lần gọi tiếp theo. Mặc định là 1.",
      },
      {
        name: "page_size",
        type: "int32",
        required: false,
        sample: "10",
        description: "Mỗi tập kết quả được trả về dưới dạng một trang entries. Sử dụng page_size để kiểm soát số lượng entries tối đa cần lấy mỗi trang (mỗi lần gọi), và page_no để bắt đầu lần gọi tiếp theo. Giá trị này dùng để chỉ định số lượng entries tối đa trả về trong một trang dữ liệu. Giới hạn page_size từ 1 đến 100. Mặc định là 10.",
      },
    ],
    responseParams: [
      { name: "error", type: "string", description: "Loại lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "message", type: "string", description: "Chi tiết lỗi nếu có lỗi xảy ra. Rỗng nếu không có lỗi." },
      { name: "request_id", type: "string", description: "ID định danh của request API, dùng để theo dõi lỗi." },
      { name: "response", type: "object", description: "Dữ liệu đơn hàng giao trễ." },
      { name: "response.late_order_list", type: "object[]", description: "Danh sách đơn hàng giao trễ." },
      { name: "response.late_order_list[].order_sn", type: "string", description: "Mã đơn hàng (Order SN)." },
      { name: "response.late_order_list[].shipping_deadline", type: "timestamp", description: "Hạn giao hàng của đơn hàng này." },
      { name: "response.late_order_list[].late_by_days", type: "int32", description: "Số ngày giao trễ của đơn hàng này." },
      { name: "response.total_count", type: "int32", description: "Tổng số đơn hàng giao trễ." },
    ],
  },
]
