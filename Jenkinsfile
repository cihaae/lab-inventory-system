pipeline {
  agent any

  environment {
    LABSTOCK_PORT = '8081'
    PATH          = "C:\\Users\\user\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin;${env.PATH}"
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
          docker compose down || ver >nul
          docker compose up --build -d
        '''
      }
    }

    stage('4. Health Check') {
      steps {
        echo 'Menjalankan health check endpoint...'
        sleep 5
        bat 'docker compose ps'
        bat 'curl.exe -fsS http://localhost:8081/api/inventory'
      }
    }
  }

  post {
    success {
      echo 'Pipeline LabStock berhasil dijalankan!'
    }
    failure {
      echo 'Pipeline LabStock gagal. Silakan periksa Console Output.'
    }
  }
