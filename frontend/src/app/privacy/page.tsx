import { Header, Footer } from '@/components/landing';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--buh-background)] flex flex-col">
      <Header />
      <main className="flex-grow container py-24 px-4 md:px-6 prose prose-invert max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--buh-foreground)] mb-8">Политика конфиденциальности</h1>
        
        <div className="space-y-6 text-[var(--buh-foreground-muted)]">
          <p>
            <strong>Дата последнего обновления:</strong> 24 ноября 2025 г.
          </p>

          <p>
            Настоящая Политика конфиденциальности описывает, как AIDevTeam (далее "Оператор") собирает, использует и защищает персональные данные пользователей сайта BuhBot.
          </p>

          <h2 className="text-xl font-bold text-[var(--buh-foreground)] mt-8 mb-4">1. Какие данные мы собираем</h2>
          <p>Мы собираем следующую информацию, которую вы предоставляете добровольно при заполнении форм на сайте:</p>
          <ul className="list-disc pl-6">
            <li>Имя</li>
            <li>Адрес электронной почты</li>
            <li>Название компании</li>
            <li>Текст сообщения</li>
          </ul>

          <h2 className="text-xl font-bold text-[var(--buh-foreground)] mt-8 mb-4">2. Цели обработки данных</h2>
          <p>Мы используем ваши данные для:</p>
          <ul className="list-disc pl-6">
            <li>Обработки ваших заявок на демонстрацию сервиса</li>
            <li>Связи с вами для уточнения деталей</li>
            <li>Улучшения качества нашего сервиса</li>
          </ul>

          <h2 className="text-xl font-bold text-[var(--buh-foreground)] mt-8 mb-4">3. Правовые основания</h2>
          <p>
            Обработка персональных данных осуществляется на основании вашего согласия, выраженного путем отправки формы на сайте (ст. 24 Конституции РФ; ст. 6 Федерального закона № 152-ФЗ «О персональных данных»).
          </p>

          <h2 className="text-xl font-bold text-[var(--buh-foreground)] mt-8 mb-4">4. Хранение и защита данных</h2>
          <p>
            Мы принимаем необходимые организационные и технические меры для защиты ваших персональных данных от неправомерного доступа. Срок хранения данных составляет 3 года, если вы не отзовете свое согласие раньше.
          </p>

          <h2 className="text-xl font-bold text-[var(--buh-foreground)] mt-8 mb-4">5. Права пользователей</h2>
          <p>Вы имеете право:</p>
          <ul className="list-disc pl-6">
            <li>Запросить информацию о своих персональных данных</li>
            <li>Потребовать уточнения, блокирования или уничтожения данных</li>
            <li>Отозвать согласие на обработку данных</li>
          </ul>

          <h2 className="text-xl font-bold text-[var(--buh-foreground)] mt-8 mb-4">6. Контакты</h2>
          <p>
            По вопросам, связанным с обработкой персональных данных, вы можете связаться с нами по адресу: <a href="mailto:contact@aidevteam.ru" className="text-[var(--buh-primary)] hover:underline">contact@aidevteam.ru</a>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
