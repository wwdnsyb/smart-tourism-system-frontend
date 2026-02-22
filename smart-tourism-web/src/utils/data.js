// 默认景点数据
const DEFAULT_ATTRACTIONS = [
  // 自然风光
  {
    id: 1,
    name: '西湖风景区',
    price: 80,
    description: '杭州西湖，中国首批国家重点风景名胜区，中国十大风景名胜之一。',
    image: 'https://picsum.photos/600/400?西湖',
    category: '自然风光'
  },
  {
    id: 2,
    name: '黄山风景区',
    price: 230,
    description: '黄山位于安徽省南部，是中国著名的山岳风景区，以奇松、怪石、云海、温泉、冬雪五绝著称。',
    image: 'https://picsum.photos/600/400?黄山',
    category: '自然风光'
  },
  {
    id: 3,
    name: '九寨沟',
    price: 190,
    description: '九寨沟位于四川省阿坝藏族羌族自治州九寨沟县，以翠海、叠瀑、彩林、雪峰、藏情、蓝冰六绝著称。',
    image: 'https://picsum.photos/600/400?九寨沟',
    category: '自然风光'
  },
  {
    id: 4,
    name: '张家界',
    price: 228,
    description: '张家界以其独特的石英砂岩峰林地貌而闻名，是电影《阿凡达》的取景地之一。',
    image: 'https://picsum.photos/600/400?张家界',
    category: '自然风光'
  },
  {
    id: 5,
    name: '桂林山水',
    price: 150,
    description: '桂林山水甲天下，以其独特的喀斯特地貌和秀美的山水风光而闻名于世。',
    image: 'https://picsum.photos/600/400?桂林',
    category: '自然风光'
  },
  {
    id: 6,
    name: '天涯海角',
    price: 95,
    description: '天涯海角位于海南省三亚市，是著名的海滨旅游胜地，以其独特的自然景观和文化内涵吸引着众多游客。',
    image: 'https://picsum.photos/600/400?天涯海角',
    category: '自然风光'
  },
  
  // 历史古迹
  {
    id: 7,
    name: '故宫博物院',
    price: 60,
    description: '北京故宫，旧称紫禁城，是中国明清两代的皇家宫殿，世界上现存规模最大、保存最为完整的木质结构古建筑之一。',
    image: 'https://picsum.photos/600/400?故宫',
    category: '历史古迹'
  },
  {
    id: 8,
    name: '长城',
    price: 80,
    description: '长城是中国古代的军事防御工程，是一道高大、坚固而连绵不断的长垣，用以限隔敌骑的行动。',
    image: 'https://picsum.photos/600/400?长城',
    category: '历史古迹'
  },
  {
    id: 9,
    name: '颐和园',
    price: 40,
    description: '颐和园位于北京市海淀区，是中国清朝时期皇家园林，它是以昆明湖、万寿山为基址，以杭州西湖为蓝本的大型山水园林。',
    image: 'https://picsum.photos/600/400?颐和园',
    category: '历史古迹'
  },
  {
    id: 10,
    name: '兵马俑',
    price: 120,
    description: '秦始皇兵马俑位于陕西省西安市，是中国古代大型雕塑群，被誉为"世界第八大奇迹"。',
    image: 'https://picsum.photos/600/400?兵马俑',
    category: '历史古迹'
  },
  {
    id: 11,
    name: '丽江古城',
    price: 50,
    description: '丽江古城是中国保存最完整的古城之一，以其独特的纳西族文化和古朴的建筑风格而闻名。',
    image: 'https://picsum.photos/600/400?丽江',
    category: '历史古迹'
  },
  {
    id: 12,
    name: '布达拉宫',
    price: 200,
    description: '布达拉宫位于西藏自治区拉萨市，是世界上海拔最高、最庞大的古代宫堡式建筑群。',
    image: 'https://picsum.photos/600/400?布达拉宫',
    category: '历史古迹'
  },
  {
    id: 13,
    name: '天坛',
    price: 35,
    description: '天坛位于北京市东城区，是明清两代皇帝祭天、祈求丰年的场所，是中国现存最大的古代祭祀性建筑群。',
    image: 'https://picsum.photos/600/400?天坛',
    category: '历史古迹'
  },
  
  // 主题乐园
  {
    id: 14,
    name: '上海迪士尼',
    price: 399,
    description: '上海迪士尼度假区是中国内地首座迪士尼主题乐园，拥有七大主题园区，为游客带来神奇、快乐的体验。',
    image: 'https://picsum.photos/600/400?disney',
    category: '主题乐园'
  },
  {
    id: 15,
    name: '环球影城',
    price: 418,
    description: '环球影城是世界著名的主题公园品牌，以好莱坞电影为主题，提供各种精彩的游乐设施和表演。',
    image: 'https://picsum.photos/600/400?环球影城',
    category: '主题乐园'
  }
]

// 获取景点数据
export const getAttractions = () => {
  const storedData = localStorage.getItem('attractions_data')
  if (storedData) {
    return JSON.parse(storedData)
  } else {
    // 存储默认数据到 localStorage
    localStorage.setItem('attractions_data', JSON.stringify(DEFAULT_ATTRACTIONS))
    return DEFAULT_ATTRACTIONS
  }
}

// 保存景点数据
export const saveAttractions = (attractions) => {
  localStorage.setItem('attractions_data', JSON.stringify(attractions))
}

// 默认订单数据
const DEFAULT_ORDERS = [
  {
    id: Date.now() - 86400000,
    user: 'user001',
    attractionName: '故宫',
    price: 60,
    count: 2,
    totalPrice: 120,
    status: '已完成',
    createTime: new Date(Date.now() - 86400000).toLocaleString()
  },
  {
    id: Date.now() - 172800000,
    user: 'user002',
    attractionName: '长城',
    price: 80,
    count: 1,
    totalPrice: 80,
    status: '待支付',
    createTime: new Date(Date.now() - 172800000).toLocaleString()
  }
]

// 获取所有订单
export const getAllOrders = () => {
  const storedData = localStorage.getItem('site_orders')
  if (storedData) {
    return JSON.parse(storedData)
  } else {
    // 存储默认数据到 localStorage
    localStorage.setItem('site_orders', JSON.stringify(DEFAULT_ORDERS))
    return DEFAULT_ORDERS
  }
}

// 添加新订单
export const addOrder = (orderObj) => {
  const orders = getAllOrders()
  // 添加到数组开头
  orders.unshift(orderObj)
  localStorage.setItem('site_orders', JSON.stringify(orders))
  return orders
}

// 获取用户订单
export const getUserOrders = (username) => {
  const orders = getAllOrders()
  return orders.filter(order => order.user === username)
}
