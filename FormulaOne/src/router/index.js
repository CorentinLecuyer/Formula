import { createRouter, createWebHistory } from 'vue-router'
import SummaryPage from '@/views/SummaryPage.vue'
import FormBuilder from '@/views/FormBuilder.vue'
import CreateForm from '@/views/CreateForm.vue'
import FormList from '@/views/FormList.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: FormList
    },
    {
      path: '/form/:slug',
      name: 'render-form',
      component: FormBuilder
    },
    {
      path: '/edit/:slug',
      name: 'EditForm',
      component: () => import('../views/CreateForm.vue') // Reuses the Builder
    },
    {
      path: '/summary',
      name: 'summary',
      component: SummaryPage
    },
    {
      path: '/create',
      name: 'create',
      component: CreateForm
    }
  ],
})

export default router
