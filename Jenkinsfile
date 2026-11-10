pipeline {
  agent any

  environment {
    LABSTOCK_PORT = '8081'
    PATH          = "C:\\Users\\user\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin;C:\\Users\\user\\AppData\\Local\\Programs\\DockerDesktop\\resources\\cli-plugins;${env.PATH}"
  }

  stages {
    stage('1. Checkout Code') {
      steps {
        echo 'Checking out source code from repository...'
        checkout scm
      }
    }

    stage('2. Syntax Check') {
      steps {
        echo 'Memvalidasi sintaks backend Python...'
        bat '"C:\\Program Files\\Python312\\python.exe" -m py_compile backend\\app.py'
      }
    }

    stage('3. Build & Deploy') {
      steps {
        echo 'Deploying application via Docker Compose...'
        bat '''
          docker-compose down || ver >nul
          docker-compose up --build -d
        '''
      }
    }

    stage('4. Health Check') {
      steps {
        echo 'Menjalankan health check endpoint...'
        retry(5) {
          sleep 5
          bat 'curl.exe -fsS http://localhost:8081/api/inventory'
        }
        bat 'docker-compose ps'
      }
    }
  }

  post {
    success {
      echo 'Pipeline LabStock berhasil dijalankan!'
    }
    failure {
      echo 'Pipeline LabStock gagal. Silakan periksa Console Output.'
      bat 'docker-compose logs --tail 30 || ver >nul'
    }
  }
}